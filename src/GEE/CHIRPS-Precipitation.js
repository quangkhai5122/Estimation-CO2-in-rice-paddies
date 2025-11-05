var countries = ee.FeatureCollection("FAO/GAUL/2015/level0");
var vietnam = countries.filter(ee.Filter.eq('ADM0_NAME', 'Viet Nam')).first();
var vietnamGeometry = vietnam.geometry();
Map.centerObject(vietnamGeometry, 6);
Map.addLayer(vietnamGeometry, {color: 'gray'}, 'Biên giới Việt Nam', false);

// Tham số hiển thị cho lượng mưa 
var precipitationVisParams = {
  min: 0.0,
  max: 50.0,
  palette: [
    '#FFFFFF', '#EFF3FF', '#BDDEBB', '#78C679', '#41AB5D', '#238443', '#005A32',
    '#FFFF00', '#FE9929', '#EC7014', '#CC4C02', '#993404', '#662506'
  ]
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

datesToProcess.forEach(function(dateString) {
  var startDate = dateString + 'T00:00:00';
  var endDate = dateString + 'T23:59:59';

  var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    .filterDate(startDate, endDate)
    .filterBounds(vietnamGeometry);

  var imageCount = chirps.size();
  var imageCHIRPS = ee.Image(ee.Algorithms.If(
    imageCount.gt(0),
    chirps.mosaic().clip(vietnamGeometry),
    // Tạo ảnh trống nếu không có dữ liệu để tránh lỗi
    ee.Image().rename(['precipitation']).selfMask()
  ));

  var precipitation = imageCHIRPS.select('precipitation');
  var processedPrecipitation = precipitation.updateMask(precipitation.gte(0));
  var finalCHIRPSImageToExport = processedPrecipitation.toFloat();

  Map.addLayer(
    processedPrecipitation,
    precipitationVisParams,
    'Lượng mưa ' + dateString,
    false 
  );

  var outputFolder = dateString;

  var outputName = 'CHIRPS_Vietnam_Precipitation_' + dateString;

  Export.image.toDrive({
    image: finalCHIRPSImageToExport,
    description: outputName,
    folder: outputFolder, 
    fileNamePrefix: outputName,
    region: vietnamGeometry.bounds(),
    scale: 5566,
    crs: 'EPSG:4326',
    maxPixels: 1e13
  });

  print('Đã tạo tác vụ xuất cho ngày:', dateString);
});