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

var era5LandHourly = ee.ImageCollection('ECMWF/ERA5_LAND/HOURLY');

datesToProcess.forEach(function(dateString) {

  print('Bắt đầu kiểm tra ngày: ' + dateString);
  
  var targetDate = ee.Date(dateString);

  var era5ForDay = era5LandHourly.filterDate(targetDate, targetDate.advance(1, 'day'));

  var imageCount = era5ForDay.size().getInfo(); 
  
  print('Số lượng ảnh tìm thấy cho ngày ' + dateString + ': ' + imageCount);

  if (imageCount > 0) {
      
      print('Đang xử lý và tạo tác vụ cho ngày ' + dateString + '...');

      var temp2mDaily = era5ForDay.select('temperature_2m')
          .map(function(image) { return image.subtract(273.15).copyProperties(image, ['system:time_start']); })
          .mean().rename('temperature_2m');
      var skinTempDaily = era5ForDay.select('skin_temperature')
          .map(function(image) { return image.subtract(273.15).copyProperties(image, ['system:time_start']); })
          .mean().rename('skin_temperature');
      var soilTempL1Daily = era5ForDay.select('soil_temperature_level_1')
          .map(function(image) { return image.subtract(273.15); })
          .mean().rename('soil_temperature_L1');
      var soilWaterL1Daily = era5ForDay.select('volumetric_soil_water_layer_1')
          .mean().rename('soil_water_L1');
      var solarRadDaily = era5ForDay.select('surface_solar_radiation_downwards_hourly')
          .sum().rename('surface_solar_radiation');
      var precipitationDaily = era5ForDay.select('total_precipitation_hourly')
          .sum().multiply(1000).rename('total_precipitation');
      var laiLowVegDaily = era5ForDay.select('leaf_area_index_low_vegetation')
          .mean().rename('lai_low_veg');
      var windUDaily = era5ForDay.select('u_component_of_wind_10m')
          .mean().rename('wind_u_10m');
      var windVDaily = era5ForDay.select('v_component_of_wind_10m')
          .mean().rename('wind_v_10m');
      var dewpointTempDaily = era5ForDay.select('dewpoint_temperature_2m')
          .map(function(image) { return image.subtract(273.15); })
          .mean().rename('dewpoint_temp_2m');
      var surfacePressureDaily = era5ForDay.select('surface_pressure')
          .mean().rename('surface_pressure');

      var finalDailyImage = ee.Image.cat([
          temp2mDaily, skinTempDaily, soilTempL1Daily, soilWaterL1Daily,
          solarRadDaily, precipitationDaily, laiLowVegDaily, windUDaily,
          windVDaily, dewpointTempDaily, surfacePressureDaily
      ]).clip(vietnamGeometry);

      var outputFolder = dateString;
      var outputName = 'ERA5_Land_Daily_Vietnam_' + dateString;
      Export.image.toDrive({
        image: finalDailyImage.toFloat(),
        description: outputName,
        folder: outputFolder,
        fileNamePrefix: outputName,
        region: vietnamGeometry.bounds(),
        scale: 9000,
        crs: 'EPSG:4326',
        maxPixels: 1e13
      });

  } else {
    print('Không tìm thấy dữ liệu cho ngày ' + dateString + '. Bỏ qua.');
  }
}); 