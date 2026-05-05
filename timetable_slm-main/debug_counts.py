
import json

def check_counts():
    try:
        with open('master_dataset.json', 'r') as f:
            content = f.read().strip()
            if not content:
                print("master_dataset.json is empty")
                return

            try:
                # Try JSON Lines
                lines = content.split('\n')
                master_data = [json.loads(line) for line in lines if line.strip()]
                print(f"master_dataset.json (JSON Lines): {len(master_data)} entries")
            except json.JSONDecodeError:
                # Try standard JSON
                master_data = json.loads(content)
                print(f"master_dataset.json (JSON List): {len(master_data)} entries")
            
            # Check internal duplicates in master
            unique_master = len(set(json.dumps(d, sort_keys=True) for d in master_data))
            print(f"Unique entries in master_dataset.json: {unique_master}")

    except Exception as e:
        print(f"Error checking master: {e}")

    try:
        with open('data.json', 'r') as f:
            data = json.load(f)
            print(f"data.json: {len(data)} entries")
    except Exception as e:
        print(f"Error checking data.json: {e}")

if __name__ == "__main__":
    check_counts()
