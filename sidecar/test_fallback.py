import asyncio
from services.llm_engine import stream_completion_with_fallback
import json

async def test_cascading_fallbacks():
    print("[test] Starting cascading fallback diagnostics...")

    # We set up a preferred model that will fail instantly (completely invalid model string)
    pref_model = "groq/completely-fake-model-invalid-name"
    
    # Our fallback chain lists a valid free model (or one that will be tried next)
    # We will verify that it registers the fallback transition correctly!
    fallback_chain = '["google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.3-70b-instruct:free"]'

    prompt = "Reply with 'Hello'"
    system_prompt = "You are a helpful assistant."

    print(f"[test] Simulating failure of model: {pref_model}")
    print("[test] Verifying engine intercepts failure and triggers fallback transition...")

    event_logs = []
    
    generator = stream_completion_with_fallback(
        prompt=prompt,
        system_prompt=system_prompt,
        preferred_model=pref_model,
        fallback_chain_json=fallback_chain,
        temperature=0.7
    )

    async for event_str in generator:
        event = json.loads(event_str)
        event_logs.append(event)
        event_type = event.get("type")
        
        if event_type == "start":
            print(f" -> Received [START] event for model: {event.get('model')}")
        elif event_type == "fallback":
            print(f" -> SUCCESS: Received [FALLBACK] warning event! Cascading from {event.get('from_model')} to {event.get('to_model')}.")
            print(f"    Reason: {event.get('reason')}")
        elif event_type == "content":
            # Just print the first char to verify streaming resumed
            print(f" -> Received [CONTENT] chunk.")
            break # We got what we needed: verified fallback worked and resumes streaming!

    # Validate that fallback occurred
    fallback_received = any(e.get("type") == "fallback" for e in event_logs)
    assert fallback_received, "Engine did not trigger a fallback event!"
    
    # Validate that we started with the fake model
    assert event_logs[0].get("model") == pref_model, "Engine did not start with preferred model!"
    
    # Validate we transitioned to the second model
    started_models = [e.get("model") for e in event_logs if e.get("type") == "start"]
    assert len(started_models) >= 2, "Engine did not attempt the fallback model!"
    assert started_models[1] == "google/gemini-2.0-flash-exp:free", f"Expected gemini fallback, got {started_models[1]}"

    print("\n[test] All cascading fallback diagnostic tests PASSED successfully! 🛡️")

if __name__ == "__main__":
    asyncio.run(test_cascading_fallbacks())
