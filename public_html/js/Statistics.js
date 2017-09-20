function Statistics() {
  
}

Statistics.covariance = function(vectorA, vectorB) {
  if (vectorA.length !== vectorB.length) {
    throw new Error('arguments lengths must be equal');
  }
  var count = vectorA.length;
  var sumA = 0;
  var sumB = 0;
  for (var i = 0; i < count; i++) {
    sumA += vectorA[i];
    sumB += vectorB[i];
  }  
  var expectedA = sumA / vectorA.length;
  var expectedB = sumB / vectorB.length;

  var s = 0;
  for (var i = 0; i < count; i++) {
    s += (vectorA[i] - expectedA) * (vectorB[i] - expectedB);
  }

  var result = s / count;

  return result;
};
