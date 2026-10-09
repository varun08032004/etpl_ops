with open(r'C:\Users\ASUS\Desktop\etpl_ops\frontend\src\pages\MyProfile.js', 'r') as f:
    lines = f.readlines()

# Find the second occurrence of "{tab === 6 && ("
indices = [i for i, line in enumerate(lines) if '{tab === 6 && (' in line]
print(f"Found {len(indices)} occurrences at lines: {[i+1 for i in indices]}")

if len(indices) >= 2:
    second_start = indices[1]
    # Find the matching closing ")}" for the second block
    brace_count = 0
    i = second_start
    found_end = False
    while i < len(lines):
        line = lines[i]
        for ch in line:
            if ch == '{' or ch == '(':
                brace_count += 1
            elif ch == '}' or ch == ')':
                brace_count -= 1
                if brace_count == 0:
                    end_line = i
                    found_end = True
                    break
        if found_end:
            break
        i += 1
    
    if found_end:
        # Remove from second_start to end_line (inclusive)
        del lines[second_start:end_line+1]
        print(f"Removed lines {second_start+1} to {end_line+1}")
        with open(r'C:\Users\ASUS\Desktop\etpl_ops\frontend\src\pages\MyProfile.js', 'w') as f:
            f.writelines(lines)
        print("Done - removed duplicate tab 6 block")
    else:
        print("Could not find matching end")
else:
    print("Less than 2 occurrences found")