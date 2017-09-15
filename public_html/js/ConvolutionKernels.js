function ConvolutionKernels() {
  
}

ConvolutionKernels.prototype.sobelX = [
  -1, 0, 1,
  -2, 0, 2,
  -1, 0, 1
];

ConvolutionKernels.prototype.sobelY = [
  -1, -2, -1,
   0,  0,  0,
   1,  2,  1
];

ConvolutionKernels.prototype.getGaussian = function(size, sigma) {
  var matrix = [];
  var s = '';
  var k = (size - 1) / 2;
  var sigma2pow2 = 2 * Math.pow(sigma, 2);
  var a = sigma2pow2 * Math.PI;
  //var summ = 0;
  for (var i = 1; i <= size; i++) {
    for (var j = 1; j <= size; j++) {
      var h = (1 / a) * Math.exp(-1 * (Math.pow(i-(k+1),2) + Math.pow(j-(k+1),2)) / sigma2pow2);      
      //summ += h;
      matrix.push(h);
      //s += h + ' ';
    }
    //s += '\n';
  }  
  //console.log(s);
  //console.log(summ);
  return matrix;
};