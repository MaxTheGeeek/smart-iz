import os
import json
import asyncio
import traceback
from typing import AsyncGenerator, List, Optional
import litellm

# Disable litellm telemetry and prompt logging to ensure speed and sandbox privacy
litellm.telemetry = False
litellm.suppress_warnings = True

def map_model_name(model_name: str) -> str:
    """
    Format standard model strings to litellm provider prefixes.
    """
    model_name = model_name.strip()
    if model_name.startswith("groq/"):
        return model_name
    
    # Check for OpenRouter prefixes
    openrouter_prefixes = ["google/", "meta-llama/", "deepseek/", "mistralai/"]
    if any(model_name.startswith(pref) for pref in openrouter_prefixes):
        if not model_name.startswith("openrouter/"):
            return f"openrouter/{model_name}"
            
    return model_name

def count_tokens(model: str, text: str) -> int:
    """
    Count tokens precisely using litellm's integrated tiktoken/provider tokenizer wrappers.
    """
    try:
        mapped_model = map_model_name(model)
        # Remove provider prefix for token counting lookup in litellm
        lookup_model = mapped_model.split("/", 1)[-1] if "/" in mapped_model else mapped_model
        return litellm.token_counter(model=lookup_model, text=text)
    except Exception as e:
        # Fallback approximation: 1 token ~= 4 characters
        return len(text) // 4

async def stream_completion_with_fallback(
    prompt: str,
    system_prompt: Optional[str] = None,
    preferred_model: str = "google/gemini-2.0-flash-exp:free",
    fallback_chain_json: str = "[]",
    openrouter_key: Optional[str] = None,
    groq_key: Optional[str] = None,
    temperature: float = 0.7
) -> AsyncGenerator[str, None]:
    """
    Universal streaming completion with robust cascading model fallbacks.
    Yields JSON chunks formatted for Server-Sent Events (SSE).
    """
    # Build models queue
    models_to_try = [preferred_model]
    try:
        extra_models = json.loads(fallback_chain_json)
        if isinstance(extra_models, list):
            for model in extra_models:
                if model not in models_to_try:
                    models_to_try.append(model)
    except Exception:
        pass
        
    # Configure keys in environment dynamically
    if openrouter_key:
        os.environ["OPENROUTER_API_KEY"] = openrouter_key
    if groq_key:
        os.environ["GROQ_API_KEY"] = groq_key

    # Track overall token counting
    prompt_tokens = 0
    completion_tokens = 0
    full_response_text = ""

    # Start generation loop through available fallback models
    model_idx = 0
    while model_idx < len(models_to_try):
        current_model = models_to_try[model_idx]
        mapped_model = map_model_name(current_model)
        
        # Ingestion analytics
        prompt_tokens = count_tokens(current_model, (system_prompt or "") + prompt)
        
        yield json.dumps({
            "type": "start",
            "model": current_model,
            "mapped_model": mapped_model,
            "prompt_tokens": prompt_tokens
        })
        
        try:
            # Build messages schema
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            # Call litellm streaming completion async
            # We run in executor to prevent litellm blocking the main async loop
            loop = asyncio.get_running_loop()
            
            def make_call():
                return litellm.completion(
                    model=mapped_model,
                    messages=messages,
                    stream=True,
                    temperature=temperature,
                    timeout=15.0 # Max wait for first token before fallback
                )
                
            response_stream = await loop.run_in_executor(None, make_call)

            # Stream chunks
            for chunk in response_stream:
                content = chunk.choices[0].delta.content
                if content:
                    full_response_text += content
                    yield json.dumps({
                        "type": "content",
                        "text": content
                    })
                    await asyncio.sleep(0.01) # Small yield for concurrency

            # Successful completion! Audit final tokens and return.
            completion_tokens = count_tokens(current_model, full_response_text)
            yield json.dumps({
                "type": "done",
                "model": current_model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
                "full_text": full_response_text
            })
            return

        except Exception as e:
            error_details = traceback.format_exc()
            print(f"[warning] Model {current_model} failed. Details:\n{error_details}")
            
            # Switch to fallback if available
            model_idx += 1
            if model_idx < len(models_to_try):
                next_model = models_to_try[model_idx]
                yield json.dumps({
                    "type": "fallback",
                    "from_model": current_model,
                    "to_model": next_model,
                    "reason": str(e)
                })
                # Reset response text on retry
                full_response_text = ""
                await asyncio.sleep(1.0) # Grace delay between retry attempts
            else:
                # All models failed!
                yield json.dumps({
                    "type": "error",
                    "message": f"All configured LLM models failed. Last error: {str(e)}"
                })
                return
