var countries = ee.FeatureCollection("FAO/GAUL/2015/level0");
var vietnam = countries.filter(ee.Filter.eq('ADM0_NAME', 'Viet Nam')).first();
var vietnamGeometry = vietnam.geometry();
Map.centerObject(vietnamGeometry, 6);
Map.addLayer(vietnamGeometry, {color: 'gray'}, 'Biên giới Việt Nam', false);

var processAOD = function(aodBand, aodQaBand, newName) {
  // Các bit 0-3 của AOD_QA: Mặt nạ Mây QA (QA Cloud Mask)
  // 0000 = Chất lượng tốt nhất, 0001 = Chất lượng tốt
  var cloudMaskQA = aodQaBand.bitwiseAnd(0x000F);
  var goodQualityMask = cloudMaskQA.lte(1); // Giữ lại pixel có chất lượng <= 1

  // Áp dụng mặt nạ và hệ số tỷ lệ
  var aodProcessed = aodBand
    .updateMask(goodQualityMask)
    .multiply(0.001)
    .rename(newName);
  return aodProcessed;
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

var mcd19a2_collection = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES');

datesToProcess.forEach(function(dateString) {

  print('Bắt đầu kiểm tra ngày: ' + dateString);

  var startDate = dateString + 'T00:00:00';
  var endDate = dateString + 'T23:59:59';

  var mcd19a2 = mcd19a2_collection.filterDate(startDate, endDate).filterBounds(vietnamGeometry);

  var imageCount = mcd19a2.size().getInfo();
  print('Số ảnh MCD19A2 tìm thấy: ' + imageCount);
  
  if (imageCount > 0) {
    
    print('Đang xử lý và tạo tác vụ cho ngày ' + dateString + '...');
    
    // 1. Tạo ảnh ghép (mosaic) và cắt (clip)
    var imageMAIAC = mcd19a2.mosaic().clip(vietnamGeometry);
    
    // 2. Chọn và xử lý các band AOD
    var opticalDepth047Raw = imageMAIAC.select('Optical_Depth_047');
    var opticalDepth055Raw = imageMAIAC.select('Optical_Depth_055');
    var aodQa = imageMAIAC.select('AOD_QA');

    var aod047 = processAOD(opticalDepth047Raw, aodQa, 'AOD_047um');
    var aod055 = processAOD(opticalDepth055Raw, aodQa, 'AOD_055um');
    
    // 3. Kết hợp các band đã xử lý thành một ảnh duy nhất để xuất
    var finalAODImageToExport = ee.Image.cat([
      aod047,
      aod055
    ]).toFloat();
    
    // 4. Xuất ảnh ra Google Drive
    var outputFolder = dateString;
    var outputName = 'MCD19A2_Vietnam_AOD_' + dateString;
    
    Export.image.toDrive({
      image: finalAODImageToExport,
      description: outputName,
      folder: outputFolder, 
      fileNamePrefix: outputName,
      region: vietnamGeometry.bounds(),
      scale: 1000, 
      crs: 'EPSG:4326',
      maxPixels: 1e13
    });

  } else {
    print('Không tìm thấy dữ liệu cho ngày ' + dateString + '. Bỏ qua.');
  }
}); 

print("Đã hoàn tất việc kiểm tra và tạo tác vụ. Vui lòng kiểm tra tab 'Tasks'.");