var countries = ee.FeatureCollection("FAO/GAUL/2015/level0");
var vietnam = countries.filter(ee.Filter.eq('ADM0_NAME', 'Viet Nam')).first();
var vietnamGeometry = vietnam.geometry();
Map.centerObject(vietnamGeometry, 6);
Map.addLayer(vietnamGeometry, {color: 'gray'}, 'Biên giới Việt Nam', false);

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

var smapL4_collection = ee.ImageCollection('NASA/SMAP/SPL4SMGP/007');

datesToProcess.forEach(function(dateString) {

  print('Bắt đầu kiểm tra ngày: ' + dateString);
  
  var targetDate = ee.Date(dateString);

  var smapForDay = smapL4_collection.filterDate(targetDate, targetDate.advance(1, 'day'));

  var imageCount = smapForDay.size().getInfo();
  print('Số lượng ảnh SMAP L4 3-hourly tìm thấy: ' + imageCount);

  if (imageCount > 0) {
    
    print('Đang xử lý và tạo tác vụ cho ngày ' + dateString + '...');
    
    // 1. Xử lý từng ảnh 3 giờ/lần để lọc theo dải giá trị hợp lệ
    var smSurfaceProcessed = smapForDay.map(function(image) {
      var sm_surface = image.select('sm_surface');
      // Áp dụng mặt nạ dựa trên dải giá trị hợp lệ (0.02 đến 0.66 m³/m³)
      var validRangeMask = sm_surface.gte(0.02).and(sm_surface.lte(0.66));
      return sm_surface.updateMask(validRangeMask)
                       .copyProperties(image, ['system:time_start']);
    });
    
    // 2. Tính trung bình ngày từ các ảnh đã lọc và clip
    var smSurfaceDailyMean = smSurfaceProcessed
        .mean() // Tính trung bình
        .rename('sm_surface_daily')
        .clip(vietnamGeometry);
        
    // 3. Xuất ảnh ra Google Drive
    var outputFolder = dateString;
    var outputName = 'SMAP_L4_Vietnam_SurfaceSoilMoisture_' + dateString;

    Export.image.toDrive({
      image: smSurfaceDailyMean.toFloat(),
      description: outputName,
      folder: outputFolder, 
      fileNamePrefix: outputName,
      region: vietnamGeometry.bounds(),
      scale: 9000, // Độ phân giải gốc của SMAP L4 là ~9km
      crs: 'EPSG:4326',
      maxPixels: 1e13
    });

  } else {
    print('Không tìm thấy dữ liệu SMAP L4 cho ngày ' + dateString + '. Bỏ qua.');
  }
}); 

print("Đã hoàn tất việc kiểm tra và tạo tác vụ. Vui lòng kiểm tra tab 'Tasks'.");