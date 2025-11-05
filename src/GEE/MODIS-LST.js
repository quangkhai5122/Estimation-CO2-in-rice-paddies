var countries = ee.FeatureCollection("FAO/GAUL/2015/level0");
var vietnam = countries.filter(ee.Filter.eq('ADM0_NAME', 'Viet Nam')).first();
var vietnamGeometry = vietnam.geometry();
Map.centerObject(vietnamGeometry, 6);
Map.addLayer(vietnamGeometry, {color: 'gray'}, 'Bien gioi Viet Nam', false);

var processLST = function(lstBand, qcBand, newName) {
  var mandatoryQA = qcBand.bitwiseAnd(0x3); 
  var qualityMask = mandatoryQA.eq(0);     

  var lstCelcius = lstBand.multiply(0.02)
                          .subtract(273.15)
                          .updateMask(qualityMask)
                          .rename(newName);
  return lstCelcius;
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

var mod11a1_collection = ee.ImageCollection('MODIS/061/MOD11A1');
var myd11a1_collection = ee.ImageCollection('MODIS/061/MYD11A1');

datesToProcess.forEach(function(dateString) {

  print('Bắt đầu kiểm tra ngày: ' + dateString);

  var startDate = dateString + 'T00:00:00';
  var endDate = dateString + 'T23:59:59';

  var mod11a1 = mod11a1_collection.filterDate(startDate, endDate).filterBounds(vietnamGeometry);
  var mod11a1_imageCount = mod11a1.size().getInfo();
  print('Số ảnh Terra (MOD11A1) tìm thấy: ' + mod11a1_imageCount);

  var lstDayTerra_C, lstNightTerra_C; 

  if (mod11a1_imageCount > 0) {
    var imageTerra = mod11a1.mosaic().clip(vietnamGeometry);
    var lstDayTerraRaw = imageTerra.select('LST_Day_1km');
    var qcDayTerra = imageTerra.select('QC_Day');
    var lstNightTerraRaw = imageTerra.select('LST_Night_1km');
    var qcNightTerra = imageTerra.select('QC_Night');
    
    lstDayTerra_C = processLST(lstDayTerraRaw, qcDayTerra, 'LST_Day_Terra_C');
    lstNightTerra_C = processLST(lstNightTerraRaw, qcNightTerra, 'LST_Night_Terra_C');
  } else {
    lstDayTerra_C = ee.Image().selfMask().rename('LST_Day_Terra_C');
    lstNightTerra_C = ee.Image().selfMask().rename('LST_Night_Terra_C');
  }

  // ----- Xử lý dữ liệu MYD11A1 (AQUA) -----
  var myd11a1 = myd11a1_collection.filterDate(startDate, endDate).filterBounds(vietnamGeometry);
  var myd11a1_imageCount = myd11a1.size().getInfo();
  print('Số ảnh Aqua (MYD11A1) tìm thấy: ' + myd11a1_imageCount);
  
  var lstDayAqua_C, lstNightAqua_C; 

  if (myd11a1_imageCount > 0) {
    var imageAqua = myd11a1.mosaic().clip(vietnamGeometry);
    var lstDayAquaRaw = imageAqua.select('LST_Day_1km');
    var qcDayAqua = imageAqua.select('QC_Day');
    var lstNightAquaRaw = imageAqua.select('LST_Night_1km');
    var qcNightAqua = imageAqua.select('QC_Night');
    
    lstDayAqua_C = processLST(lstDayAquaRaw, qcDayAqua, 'LST_Day_Aqua_C');
    lstNightAqua_C = processLST(lstNightAquaRaw, qcNightAqua, 'LST_Night_Aqua_C');
  } else {
    lstDayAqua_C = ee.Image().selfMask().rename('LST_Day_Aqua_C');
    lstNightAqua_C = ee.Image().selfMask().rename('LST_Night_Aqua_C');
  }

  // ----- Kết hợp và Xuất ảnh -----
  // Chỉ tạo tác vụ xuất nếu có ít nhất một ảnh (Terra hoặc Aqua) được tìm thấy
  if (mod11a1_imageCount > 0 || myd11a1_imageCount > 0) {
    
    print('Đang tạo tác vụ xuất cho ngày ' + dateString + '...');

    // Tạo một ảnh đa band chứa tất cả 4 band LST đã xử lý
    var finalLSTImageToExport = ee.Image.cat([
      lstDayTerra_C,
      lstNightTerra_C,
      lstDayAqua_C,
      lstNightAqua_C
    ]).toFloat();

    var outputFolder = dateString;
    var outputName = 'MODIS_Vietnam_LST_' + dateString;

    Export.image.toDrive({
      image: finalLSTImageToExport,
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