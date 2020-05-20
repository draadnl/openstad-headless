module.exports = function (polygon) {
  if (!polygon.coordinates) return [];
  
  // Coordinates are in a double array, we only need the first part
  return polygon.coordinates[0].map(x => {
    return {lat: x[0], lng: x[1]};
  });
}
