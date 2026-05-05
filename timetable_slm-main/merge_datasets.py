
import json

def load_data(filename):
    data = []
    try:
        with open(filename, 'r') as f:
            content = f.read().strip()
            if not content:
                print(f"Warning: {filename} is empty.")
                return []
            
            # Try parsing as standard JSON list
            try:
                data = json.loads(content)
                if isinstance(data, list):
                    print(f"Successfully loaded {filename} as JSON list.")
                    return data
                else:
                    print(f"Warning: {filename} is valid JSON but not a list (got {type(data)}). Wrapping in list.")
                    return [data]
            except json.JSONDecodeError:
                # Try parsing as JSON Lines (one JSON object per line)
                try:
                    lines = content.split('\n')
                    data = [json.loads(line) for line in lines if line.strip()]
                    print(f"Successfully loaded {filename} as JSON Lines ({len(data)} entries).")
                    return data
                except json.JSONDecodeError as e:
                    print(f"Error: Failed to parse {filename} as JSON or JSON Lines. Error: {e}")
                    return []
    except FileNotFoundError:
        print(f"Error: {filename} not found.")
        return []

def merge_datasets():
    master_data = load_data('master_dataset.json')
    new_data = load_data('data.json')

    print(f"Entries from master_dataset.json: {len(master_data)}")
    print(f"Entries from data.json: {len(new_data)}")

    if not master_data and not new_data:
        print("No data loaded. Exiting.")
        return

    # Combine lists
    combined_data = master_data + new_data
    
    # Remove duplicates
    unique_data = []
    seen = set()
    
    for entry in combined_data:
        # Sort keys to ensure consistent string representation
        # Use simple string checks to avoid complex object issues
        try:
            entry_str = json.dumps(entry, sort_keys=True)
            if entry_str not in seen:
                seen.add(entry_str)
                unique_data.append(entry)
        except TypeError:
            print(f"Warning: Skipping non-serializable entry: {entry}")
    
    print(f"Total entries after merge (removing duplicates): {len(unique_data)}")
    
    # Write to new file as JSON List (standard format for most tools)
    output_filename = 'merged_dataset.json'
    with open(output_filename, 'w') as f:
        json.dump(unique_data, f, indent=2)
    
    print(f"Merged data saved to {output_filename}")

if __name__ == "__main__":
    merge_datasets()
