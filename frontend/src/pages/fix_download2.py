with open(r'C:\Users\ASUS\Desktop\etpl_ops\frontend\src\pages\MyProfile.js', 'r') as f:
    content = f.read()

old = 'onClick={() => window.open(\'/api/asset-agent/agent-download-info\', \'_blank\')}'
new = 'onClick={async () => { try { const { data } = await client.get(\'/asset-agent/agent-download-info\'); if (data.download_url) { window.open(data.download_url, \'_blank\'); } } catch (err) { alert(\'Failed to get download link\'); } }}'

content = content.replace(old, new)

with open(r'C:\Users\ASUS\Desktop\etpl_ops\frontend\src\pages\MyProfile.js', 'w') as f:
    f.write(content)

print("Done - replaced", content.count('onClick={async'))