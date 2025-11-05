var countries = ee.FeatureCollection("FAO/GAUL/2015/level0");
var vietnam = countries.filter(ee.Filter.eq('ADM0_NAME', 'Viet Nam')).first();
var vietnamGeometry = vietnam.geometry();
Map.centerObject(vietnamGeometry, 6);
Map.addLayer(vietnamGeometry, {color: 'gray'}, 'Biên giới Việt Nam', false);

var parBandNames = [
  'GMT_0000_PAR', 'GMT_0300_PAR', 'GMT_0600_PAR', 'GMT_0900_PAR'
];

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

var mcd18c2_collection = ee.ImageCollection('MODIS/062/MCD18C2');


datesToProcess.forEach(function(dateString) {

  print('Bắt đầu kiểm tra ngày: ' + dateString);

  var startDate = dateString + 'T00:00:00';
  var endDate = dateString + 'T23:59:59';

  var mcd18c2 = mcd18c2_collection.filterDate(startDate, endDate).filterBounds(vietnamGeometry);

  var imageCount = mcd18c2.size().getInfo();
  print('Số ảnh MCD18C2 tìm thấy: ' + imageCount);

  if (imageCount > 0) {

    print('Đang xử lý và tạo tác vụ cho ngày ' + dateString + '...');

    // 1. Tạo ảnh ghép (mosaic) và cắt (clip)
    var imageMCD18C2 = mcd18c2.mosaic().clip(vietnamGeometry);
    
    // 2. Chọn các band PAR từ ảnh đã mosaic
    var selectedBandsImage = imageMCD18C2.select(parBandNames);

    // 3. Hàm để xử lý giá trị không hợp lệ cho từng band PAR
    var processParBand = function(bandName) {
      var band = selectedBandsImage.select(bandName);
      // Giữ lại các giá trị trong dải hợp lệ (0-1500)
      return band.updateMask(band.gte(0).and(band.lte(1500)));
    };

    // 4. Áp dụng xử lý cho 4 band đã chọn
    var gmt0000par = processParBand('GMT_0000_PAR');
    var gmt0300par = processParBand('GMT_0300_PAR');
    var gmt0600par = processParBand('GMT_0600_PAR');
    var gmt0900par = processParBand('GMT_0900_PAR');
    
    // 5. Kết hợp các band đã xử lý thành một ảnh duy nhất để xuất
    var finalMCD18ImageToExport = ee.Image.cat([
      gmt0000par, gmt0300par, gmt0600par, gmt0900par
    ]).toFloat();
    
    // 6. Xuất ảnh 
    var outputFolder = dateString;
    var outputName = 'MCD18C2_Vietnam_PAR_4Times_' + dateString;

    Export.image.toDrive({
      image: finalMCD18ImageToExport,
      description: outputName,
      folder: outputFolder, 
      fileNamePrefix: outputName,
      region: vietnamGeometry.bounds(),
      scale: 5600, 
      crs: 'EPSG:4326',
      maxPixels: 1e13
    });

  } else {
    print('Không tìm thấy dữ liệu cho ngày ' + dateString + '. Bỏ qua.');
  }
}); 

print("Đã hoàn tất việc kiểm tra và tạo tác vụ. Vui lòng kiểm tra tab 'Tasks'.");