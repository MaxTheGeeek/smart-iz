from fastapi.testclient import TestClient
from main import app

def test_routes():
    print("[test] Initializing TestClient...")
    # TestClient context manager triggers lifespan events (database creation & seeding!)
    with TestClient(app) as client:
        print("[test] Lifespan initialized successfully.")
        
        # 1. Test Health
        print("[test] Testing GET /health...")
        response = client.get("/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["status"] == "ok"
        print("[test] Health endpoint is OK.")

        # 2. Test Resumes List
        print("[test] Testing GET /api/resumes...")
        response = client.get("/api/resumes")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        resumes = response.json()
        assert isinstance(resumes, list), "Expected list of resumes"
        print(f"[test] Resumes endpoint is OK (found {len(resumes)} resumes).")

        # 3. Test Templates List
        print("[test] Testing GET /api/templates...")
        response = client.get("/api/templates")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        templates = response.json()
        assert isinstance(templates, list), "Expected list of templates"
        print(f"[test] Templates endpoint is OK (found {len(templates)} templates).")

    print("\n[test] All router diagnostic tests PASSED successfully! 🚀")

if __name__ == "__main__":
    test_routes()
