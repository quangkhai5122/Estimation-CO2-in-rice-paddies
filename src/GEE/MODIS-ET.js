var countries = ee.FeatureCollection("FAO/GAUL/2015/level0");
var vietnam = countries.filter(ee.Filter.eq('ADM0_NAME', 'Viet Nam')).first();
var vietnamGeometry = vietnam.geometry();
Map.centerObject(vietnamGeometry, 6);
Map.addLayer(vietnamGeometry, {color: 'gray'}, 'Biên giới Việt Nam', false);

// 2. Hàm trợ giúp để xử lý các band của MOD16
var processMOD16Band_Corrected = function(dataBand, qcBand, newName, scaleFactor) {
  var modlandQC = qcBand.bitwiseAnd(1);
  var goodQualityMask = modlandQC.eq(0);
  var validDataMask = dataBand.lte(32700);
  var combinedMask = goodQualityMask.and(validDataMask);

  return dataBand
    .updateMask(combinedMask)
    .multiply(scaleFactor)
    .rename(newName);
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

var mod16a2gf_collection = ee.ImageCollection('MODIS/061/MOD16A2GF');

datesToProcess.forEach(function(dateString) {

  print('Bắt đầu kiểm tra ngày: ' + dateString);
  
  var targetDate = ee.Date(dateString);

  var potentialImageCollection = mod16a2gf_collection
    .filter(ee.Filter.lte('system:time_start', targetDate.millis())) 
    .sort('system:time_start', false)
    .limit(1); 

  var imageCount = potentialImageCollection.size().getInfo();
  print('Kiểm tra ảnh tiềm năng... Số lượng tìm thấy: ' + imageCount);
  
  if (imageCount > 0) {
    var imageMOD16 = potentialImageCollection.first(); 
    
    print('Đã tìm thấy ảnh hợp lệ. Đang xử lý và tạo tác vụ cho ngày ' + dateString + '...');
      
    // -- Bắt đầu xử lý ảnh --
    var clippedImage = imageMOD16.clip(vietnamGeometry);
      
    var etRaw = clippedImage.select('ET');
    var leRaw = clippedImage.select('LE');
    var petRaw = clippedImage.select('PET');
    var pleRaw = clippedImage.select('PLE');
    var etQc = clippedImage.select('ET_QC');
  
    var et = processMOD16Band_Corrected(etRaw, etQc, 'ET', 0.1);
    var le = processMOD16Band_Corrected(leRaw, etQc, 'LE', 10000);
    var pet = processMOD16Band_Corrected(petRaw, etQc, 'PET', 0.1);
    var ple = processMOD16Band_Corrected(pleRaw, etQc, 'PLE', 10000);
      
    var finalMOD16ImageToExport = ee.Image.cat([et, le, pet, ple]).toFloat();
      
    // -- Xuất ảnh --
    var outputFolder = dateString;
    var outputName = 'MOD16A2GF_Vietnam_ET_PET_' + dateString;
  
    Export.image.toDrive({
      image: finalMOD16ImageToExport,
      description: outputName,
      folder: outputFolder,
      fileNamePrefix: outputName,
      region: vietnamGeometry.bounds(),
      scale: 500,
      crs: 'EPSG:4326',
      maxPixels: 1e13
    });

  } else {
    print('Không có dữ liệu MOD16A2GF nào bắt đầu trước hoặc bằng ngày ' + dateString + '. Bỏ qua.');
  }
}); 

print("Đã hoàn tất việc kiểm tra và tạo tác vụ. Vui lòng kiểm tra tab 'Tasks'.");