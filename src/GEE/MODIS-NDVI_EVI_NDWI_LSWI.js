var countries = ee.FeatureCollection("FAO/GAUL/2015/level0");
var vietnam = countries.filter(ee.Filter.eq('ADM0_NAME', 'Viet Nam')).first();
var vietnamGeometry = vietnam.geometry();
Map.centerObject(vietnamGeometry, 6);
Map.addLayer(vietnamGeometry, {color: 'gray'}, 'Bien gioi Viet Nam', false);


function maskMOD09GAQuality(image) {
  var qc500m = image.select('QC_500m'); 
  var modlandQA = qc500m.bitwiseAnd(0x0003); 
  var idealQualityMask = modlandQA.eq(0);
  return image.updateMask(idealQualityMask);
}

// Hàm tính toán chỉ số NDVI
var calculateNDVI = function(img) {
  return img.normalizedDifference(['nir', 'red']).rename('NDVI');
};

// Hàm tính toán chỉ số EVI
var calculateEVI = function(img) {
  var nir_evi = img.select('nir');
  var red_evi = img.select('red');
  var blue_evi = img.select('blue');
  var eviNumerator = nir_evi.subtract(red_evi);
  var eviDenominator = nir_evi.add(red_evi.multiply(6)).subtract(blue_evi.multiply(7.5)).add(1);
  return eviNumerator.divide(eviDenominator).multiply(2.5).rename('EVI');
};

// Hàm tính toán chỉ số LSWI
var calculateLSWI = function(img) {
  return img.normalizedDifference(['nir', 'swir1']).rename('LSWI');
};

// Hàm tính toán chỉ số NDWI (McFeeters)
var calculateNDWI_McFeeters = function(img) {
  return img.normalizedDifference(['green', 'nir']).rename('NDWI_McFeeters');
};

var datesToProcess = [
  '2021-01-02','2021-01-04','2021-01-09','2021-01-11','2021-01-16','2021-01-18','2021-01-25',
  '2021-02-10','2021-02-12','2021-02-17','2021-02-19','2021-02-26','2021-03-05','2021-03-07',
  '2021-03-14','2021-03-16','2021-03-23','2021-03-30','2021-04-08','2021-04-15','2021-04-22',
  '2021-04-24','2021-05-10','2021-05-12','2021-05-26','2021-06-02','2021-06-18','2021-06-20',
  '2021-07-04','2021-07-06','2021-07-11','2021-07-20','2021-07-29','2021-08-05','2021-08-21',
  '2021-08-23','2021-08-28','2021-08-30','2021-09-06','2021-09-17','2021-09-29','2021-10-01',
  '2021-10-19','2021-10-26','2021-11-18','2021-11-20','2021-11-25','2021-11-27','2021-12-02',
  '2021-12-04','2021-12-13','2021-12-22','2021-12-27','2021-12-29'
];

var mod09ga_collection = ee.ImageCollection('MODIS/061/MOD09GA');

datesToProcess.forEach(function(dateString) {

  print('Bắt đầu kiểm tra ngày: ' + dateString);

  var startDate = dateString + 'T00:00:00';
  var endDate = dateString + 'T23:59:59';
  var mod09ga = mod09ga_collection.filterDate(startDate, endDate).filterBounds(vietnamGeometry);

  var imageCount = mod09ga.size().getInfo();
  print('Số ảnh MOD09GA tìm thấy: ' + imageCount);

  if (imageCount > 0) {
    
    print('Đang xử lý và tạo tác vụ cho ngày ' + dateString + '...');
    
    // 1. Tạo ảnh ghép (mosaic) và clip
    var rawMosaic = mod09ga.mosaic().clip(vietnamGeometry);
    
    // 2. Áp dụng mặt nạ chất lượng
    var image = maskMOD09GAQuality(rawMosaic);
    
    // 3. Chọn các band cần thiết và áp dụng scale factor
    var blueBand = image.select('sur_refl_b03').multiply(0.0001).rename('blue');
    var greenBand = image.select('sur_refl_b04').multiply(0.0001).rename('green');
    var redBand = image.select('sur_refl_b01').multiply(0.0001).rename('red');
    var nirBand = image.select('sur_refl_b02').multiply(0.0001).rename('nir');
    var swir1Band = image.select('sur_refl_b06').multiply(0.0001).rename('swir1');
    
    // 4. Chuẩn bị ảnh đã xử lý với các band cần thiết
    var processedImageForIndices = ee.Image.cat([
      blueBand, greenBand, redBand, nirBand, swir1Band
    ]);
    
    // 5. Tính toán các chỉ số
    var ndviImage = calculateNDVI(processedImageForIndices);
    var eviImage = calculateEVI(processedImageForIndices);
    var lswiImage = calculateLSWI(processedImageForIndices);
    var ndwiMcFeetersImage = calculateNDWI_McFeeters(processedImageForIndices);
    
    // 6. Kết hợp các chỉ số thành một ảnh duy nhất để xuất
    var finalImageToExport = ee.Image.cat([
      ndviImage, eviImage, lswiImage, ndwiMcFeetersImage
    ]).toFloat();

    // 7. Xuất ảnh
    var outputFolder = dateString;
    var outputName = 'MOD09GA_Vietnam_NDVI_EVI_LSWI_NDWI_' + dateString;
    
    Export.image.toDrive({
      image: finalImageToExport,
      description: outputName,
      folder: outputFolder, 
      fileNamePrefix: outputName,
      region: vietnamGeometry.bounds(),
      scale: 500, 
      crs: 'EPSG:4326',
      maxPixels: 1e13
    });

  } else {
    print('Không tìm thấy dữ liệu cho ngày ' + dateString + '. Bỏ qua.');
  }
});

print("Đã hoàn tất việc kiểm tra và tạo tác vụ. Vui lòng kiểm tra tab 'Tasks'.");