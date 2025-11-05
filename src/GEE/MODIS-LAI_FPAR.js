var countries = ee.FeatureCollection("FAO/GAUL/2015/level0");
var vietnam = countries.filter(ee.Filter.eq('ADM0_NAME', 'Viet Nam')).first();
var vietnamGeometry = vietnam.geometry();
Map.centerObject(vietnamGeometry, 6);
Map.addLayer(vietnamGeometry, {color: 'gray'}, 'Bien gioi Viet Nam', false);

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

var mcd15a3h_collection = ee.ImageCollection('MODIS/061/MCD15A3H');

datesToProcess.forEach(function(dateString) {

  print('Bắt đầu kiểm tra ngày: ' + dateString);
  
  var targetDate = ee.Date(dateString);

  // 1. Lọc tất cả ảnh có ngày bắt đầu TRƯỚC HOẶC BẰNG ngày mục tiêu
  // 2. Sắp xếp giảm dần (để ảnh gần nhất lên đầu)
  // 3. Chỉ lấy 1 ảnh đầu tiên
  var potentialImageCollection = mcd15a3h_collection
    .filter(ee.Filter.lte('system:time_start', targetDate.millis()))
    .sort('system:time_start', false) 
    .limit(1);

  var imageCount = potentialImageCollection.size().getInfo();
  print('Kiểm tra ảnh tiềm năng... Số lượng tìm thấy: ' + imageCount);
  
  if (imageCount > 0) {
    var imageMCD15A3H = potentialImageCollection.first();
    
    print('Đã tìm thấy ảnh hợp lệ. Ngày bắt đầu của ảnh: ' + imageMCD15A3H.date().format('YYYY-MM-dd').getInfo());
    print('Đang xử lý và tạo tác vụ cho ngày ' + dateString + '...');
      
    // -- Bắt đầu xử lý ảnh --
    var clippedImage = imageMCD15A3H.clip(vietnamGeometry);
    
    // 1. Chọn band và áp dụng hệ số tỷ lệ
    var fpar = clippedImage.select('Fpar').multiply(0.01);
    var lai = clippedImage.select('Lai').multiply(0.1);
    
    // 2. Lọc chất lượng
    var qc = clippedImage.select('FparLai_QC');
    // Bit 0 của FparLai_QC: MODLAND_QC (0 = Chất lượng tốt nhất)
    var goodQualityMask = qc.bitwiseAnd(1).eq(0);
    
    // 3. Áp dụng mặt nạ chất lượng
    var fpar_processed = fpar.updateMask(goodQualityMask).rename('FPAR');
    var lai_processed = lai.updateMask(goodQualityMask).rename('LAI');
    
    // 4. Kết hợp các band đã xử lý thành một ảnh duy nhất để xuất
    var finalImageToExport = ee.Image.cat([
      fpar_processed,
      lai_processed
    ]).toFloat();
      
    // -- Xuất ảnh --
    var outputFolder = dateString; 
    var outputName = 'MCD15A3H_Vietnam_FPAR_LAI_' + dateString;
  
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
    print('Không có dữ liệu MCD15A3H nào bắt đầu trước hoặc bằng ngày ' + dateString + '. Bỏ qua.');
  }
}); 
print("Đã hoàn tất việc kiểm tra và tạo tác vụ. Vui lòng kiểm tra tab 'Tasks'.");