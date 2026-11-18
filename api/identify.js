export default function identifyItem(_request, response) {
  return response.status(503).json({
    error: 'Photo identification is not configured for this deployment. You can enter the item details yourself.',
  })
}
