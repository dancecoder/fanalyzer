function AnalyticalData() {
  this.axisArray = null;
  this.initialSymmetryAxis = null;
  this.symmetryAxis = null;
}

AnalyticalData.prototype.getAxis = function(azimut) {
  if (this.axisArray !== null) {
    return this.axisArray[azimut];
  }
  return null;
};

AnalyticalData.prototype.setAxisArray = function(value) {
  this.axisArray = value;
};


AnalyticalData.prototype.setSymmetryAxis = function(value) {
  if (this.initialSymmetryAxis === null) {
    this.initialSymmetryAxis = value;
  }
  this.symmetryAxis = value;
};

AnalyticalData.prototype.adjustSymmetryAxis = function(delta) {
  if(this.initialSymmetryAxis !== null) {
    this.symmetryAxis = this.initialSymmetryAxis + delta;
    if (this.symmetryAxis > 360) {
      this.symmetryAxis -= 360;
    }
    if (this.symmetryAxis < 0) {
      this.symmetryAxis += 360;
    }
  }
};

AnalyticalData.prototype.getSymmetryAxis = function() {
  return this.symmetryAxis;
};

AnalyticalData.prototype.exportToTSV = function() {
  var exportData = '';
  if (this.symmetryAxis !== null) {
    for (var i = this.symmetryAxis; i < 360; i++) {
      var axis = this.axisArray[i];
      exportData += axis.length.toLocaleString();
      exportData += '\t';
    }
    for (var i = 0; i < this.symmetryAxis; i++) {
      var axis = this.axisArray[i];
      exportData += axis.length.toLocaleString();
      exportData += '\t';
    }
  }
  return exportData;
};