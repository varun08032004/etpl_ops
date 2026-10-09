with open(r'C:\Users\ASUS\Desktop\etpl_ops\frontend\src\pages\MyProfile.js', 'r') as f:
    content = f.read()

# Remove the duplicate tab 6 block (the second occurrence)
# Find the second occurrence of "{tab === 6 && ("
first = content.find('{tab === 6 && (')
second = content.find('{tab === 6 && (', first + 1)

if second != -1:
    # Find the matching closing ")}" for the second block
    # We need to find the matching closing brace
    brace_count = 0
    i = second
    while i < len(content):
        if content[i] == '{' or content[i] == '(':
            brace_count += 1
        elif content[i] == '}' or content[i] == ')':
            brace_count -= 1
            if brace_count == 0:
                # Found the end of the block
                end = i + 1
                # Remove from second to end
                content = content[:second] + content[end:]
                break
        i += 1

with open(r'C:\Users\ASUS\Desktop\etpl_ops\frontend\src\pages\MyProfile.js', 'w') as f:
    f.write(content)

print("Done - removed duplicate tab 6 block")