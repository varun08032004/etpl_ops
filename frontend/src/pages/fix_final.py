with open(r'C:\Users\ASUS\Desktop\etpl_ops\frontend\src\pages\MyProfile.js', 'r') as f:
    content = f.read()

# Fix 1: Update first occurrence (tab 6 - line ~493)
old1 = 'onClick={() => window.open(\'/api/asset-agent/agent-download-info\', \'_blank\')}'
new1 = '''onClick={async () => {
                 try {
                   const { data } = await client.get('/asset-agent/agent-download-info');
                   if (data.download_url) {
                     window.open(data.download_url, '_blank');
                   }
                 } catch (err) {
                   alert('Failed to get download link');
                 }
               }}'''
content = content.replace(old1, new1, 1)  # Only replace first occurrence

# Fix 2: Remove the duplicate tab 6 block (second occurrence)
# Find the second occurrence of "{tab === 6 && ("
first = content.find('{tab === 6 && (')
second = content.find('{tab === 6 && (', first + 1)

if second != -1:
    # Find the matching closing ")}" for the second block
    brace_count = 0
    i = second
    while i < len(content):
        ch = content[i]
        if ch == '{' or ch == '(':
            brace_count += 1
        elif ch == '}' or ch == ')':
            brace_count -= 1
            if brace_count == 0:
                # Found the end
                end = i + 1
                content = content[:second] + content[end:]
                break
        i += 1

with open(r'C:\Users\ASUS\Desktop\etpl_ops\frontend\src\pages\MyProfile.js', 'w') as f:
    f.write(content)

print("Done")