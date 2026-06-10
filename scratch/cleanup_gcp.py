import subprocess
import json
import concurrent.futures

def run_cmd(args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"Command failed: {' '.join(args)}\nError: {result.stderr}")
    return result.stdout

def main():
    service_name = "backend"
    region = "us-central1"
    
    print(f"Fetching {service_name} service description...")
    try:
        service_json = json.loads(run_cmd(["gcloud", "run", "services", "describe", service_name, "--region", region, "--format", "json"]))
    except Exception as e:
        print(f"Error fetching service: {e}")
        return

    # Identify the active revision and its image digest
    traffic = service_json.get("status", {}).get("traffic", [])
    active_revision = None
    for item in traffic:
        if item.get("percent") == 100:
            active_revision = item.get("revisionName")
            break
            
    if not active_revision:
        active_revision = service_json.get("status", {}).get("latestReadyRevisionName")
        
    print(f"Active revision to KEEP: {active_revision}")
    
    # Fetch all revisions
    print("Listing all revisions...")
    try:
        revisions_list = json.loads(run_cmd(["gcloud", "run", "revisions", "list", "--service", service_name, "--region", region, "--format", "json"]))
    except Exception as e:
        print(f"Error listing revisions: {e}")
        return

    active_digest = None
    for rev in revisions_list:
        if rev.get("metadata", {}).get("name") == active_revision:
            # Check status imageDigest or container image
            active_digest = rev.get("status", {}).get("imageDigest")
            if not active_digest:
                # Fallback to container spec image
                containers = rev.get("spec", {}).get("containers", [])
                if containers:
                    image_path = containers[0].get("image", "")
                    if "@sha256:" in image_path:
                        active_digest = image_path.split("@")[-1]
            break
            
    print(f"Active image digest to KEEP: {active_digest}")
    
    # Collect revisions to delete
    revisions_to_delete = []
    for rev in revisions_list:
        name = rev.get("metadata", {}).get("name")
        if name != active_revision:
            revisions_to_delete.append(name)
            
    print(f"Found {len(revisions_to_delete)} old revisions to delete.")
    
    # Concurrently delete revisions
    if revisions_to_delete:
        print("Starting parallel deletion of old revisions...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(run_cmd, ["gcloud", "run", "revisions", "delete", rev, "--region", region, "--quiet"]): rev for rev in revisions_to_delete}
            for i, future in enumerate(concurrent.futures.as_completed(futures)):
                rev = futures[future]
                try:
                    future.result()
                    print(f"[{i+1}/{len(revisions_to_delete)}] Deleted revision: {rev}")
                except Exception as e:
                    print(f"[{i+1}/{len(revisions_to_delete)}] Error deleting {rev}: {e}")
                    
    # Delete old container images in GCR
    image_repo = "gcr.io/trisphere-4b121/backend"
    print(f"Fetching GCR container images for {image_repo}...")
    try:
        images_list = json.loads(run_cmd(["gcloud", "container", "images", "list-tags", image_repo, "--limit=999", "--format", "json"]))
    except Exception as e:
        print(f"Error fetching GCR images: {e}")
        return
    
    images_to_delete = []
    for img in images_list:
        digest = img.get("digest")
        full_image_path = f"{image_repo}@{digest}"
        # Keep the active image digest
        if active_digest and digest not in active_digest:
            images_to_delete.append(full_image_path)
            
    print(f"Found {len(images_to_delete)} old container images to delete in GCR.")
    
    # Concurrently delete images
    if images_to_delete:
        print("Starting parallel deletion of old GCR images...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(run_cmd, ["gcloud", "container", "images", "delete", img, "--force-delete-tags", "--quiet"]): img for img in images_to_delete}
            for i, future in enumerate(concurrent.futures.as_completed(futures)):
                img = futures[future]
                try:
                    future.result()
                    print(f"[{i+1}/{len(images_to_delete)}] Deleted GCR image: {img}")
                except Exception as e:
                    print(f"[{i+1}/{len(images_to_delete)}] Error deleting image {img}: {e}")
                    
    print("\nCleanup completed successfully!")

if __name__ == "__main__":
    main()
