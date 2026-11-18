export async function identifyItem(image, accessToken, signal) {
  const response = await fetch('/api/identify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ image }),
    signal,
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Could not identify this photo. You can enter the details yourself.')
  return result
}
