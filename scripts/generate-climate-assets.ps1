param(
  [string]$OutputRoot = (Join-Path $PSScriptRoot "..\\public\\climate")
)

$ErrorActionPreference = "Stop"

$drawingAssembly = [System.Drawing.Bitmap].Assembly.Location
$drawingAssemblyDir = Split-Path -Path $drawingAssembly -Parent
$drawingPrimitivesAssembly = Join-Path $drawingAssemblyDir "System.Drawing.Primitives.dll"
$windowsCoreAssembly = Join-Path $drawingAssemblyDir "System.Private.Windows.Core.dll"

if (-not $drawingAssembly) {
  throw "Không tìm thấy System.Drawing.Common.dll trên máy."
}

$referencedAssemblies = @($drawingAssembly)
if (Test-Path $drawingPrimitivesAssembly) {
  $referencedAssemblies += $drawingPrimitivesAssembly
}
if (Test-Path $windowsCoreAssembly) {
  $referencedAssemblies += $windowsCoreAssembly
}

Add-Type -Language CSharp -ReferencedAssemblies $referencedAssemblies @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class ClimateRasterBuilder
{
    private const int Width = 1024;
    private const int Height = 512;
    private const double TempMin = -35.0;
    private const double TempMax = 45.0;
    private const double RainMin = 0.0;
    private const double RainMax = 400.0;

    private static double Clamp(double value, double min, double max)
    {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    private static double WrapLongitude(double delta)
    {
        while (delta > 180.0) delta -= 360.0;
        while (delta < -180.0) delta += 360.0;
        return delta;
    }

    private static double Gaussian(double lat, double lon, double lat0, double lon0, double latSigma, double lonSigma)
    {
        double dLat = (lat - lat0) / latSigma;
        double dLon = WrapLongitude(lon - lon0) / lonSigma;
        return Math.Exp(-0.5 * (dLat * dLat + dLon * dLon));
    }

    private static byte Normalize(double value, double min, double max)
    {
        double t = Clamp((value - min) / (max - min), 0.0, 1.0);
        return (byte)Math.Round(t * 255.0);
    }

    private static double TemperatureValue(double lat, double lon, int monthIndex)
    {
        double latAbs = Math.Abs(lat);
        double latNorm = latAbs / 90.0;
        double latitudeBase = 29.0 - (latAbs * 0.72) - (8.0 * latNorm * latNorm);
        double seasonalPhase = 2.0 * Math.PI * (monthIndex - 6) / 12.0;
        double seasonalAmplitude = 18.0 * Math.Pow(latNorm, 1.1);
        double seasonal = seasonalAmplitude * Math.Cos(seasonalPhase) * (lat >= 0.0 ? 1.0 : -1.0);
        double wave = 2.8 * Math.Sin((lon + 25.0) * Math.PI / 90.0) * (0.2 + Math.Sin((lat + 10.0) * Math.PI / 180.0));

        double sahara = 9.0 * Gaussian(lat, lon, 23.0, 13.0, 10.0, 26.0);
        double arabia = 5.5 * Gaussian(lat, lon, 24.0, 45.0, 9.0, 14.0);
        double australia = 5.0 * Gaussian(lat, lon, -25.0, 133.0, 12.0, 24.0);
        double amazonCool = -2.8 * Gaussian(lat, lon, -4.0, -62.0, 10.0, 24.0);
        double andes = -8.5 * Gaussian(lat, lon, -18.0, -70.0, 9.0, 12.0);
        double himalaya = -11.0 * Gaussian(lat, lon, 29.0, 86.0, 8.0, 13.0);
        double greenland = -9.5 * Gaussian(lat, lon, 72.0, -40.0, 12.0, 22.0);

        double raw = latitudeBase + seasonal + wave + sahara + arabia + australia + amazonCool + andes + himalaya + greenland;
        return Clamp(raw, TempMin, TempMax);
    }

    private static double RainfallValue(double lat, double lon, int monthIndex)
    {
        double latAbs = Math.Abs(lat);
        double monthAngle = 2.0 * Math.PI * monthIndex / 12.0;
        double itczLatitude = 7.0 * Math.Sin(monthAngle);
        double itcz = 180.0 * Math.Exp(-0.5 * Math.Pow((lat - itczLatitude) / 10.0, 2.0));
        double midLatitudeStorms = 52.0 * Math.Exp(-0.5 * Math.Pow((latAbs - 48.0) / 11.0, 2.0));
        double subtropicalDry = -96.0 * Math.Exp(-0.5 * Math.Pow((latAbs - 25.0) / 8.0, 2.0));

        double amazon = 120.0 * Gaussian(lat, lon, -4.0, -62.0, 11.0, 24.0);
        double congo = 100.0 * Gaussian(lat, lon, 0.0, 20.0, 10.0, 20.0);
        double maritime = 140.0 * Gaussian(lat, lon, 0.0, 120.0, 14.0, 28.0);
        double saharaDry = -145.0 * Gaussian(lat, lon, 23.0, 13.0, 11.0, 28.0);
        double arabiaDry = -95.0 * Gaussian(lat, lon, 24.0, 45.0, 9.0, 16.0);
        double atacamaDry = -150.0 * Gaussian(lat, lon, -23.0, -69.0, 7.0, 10.0);
        double australiaDry = -112.0 * Gaussian(lat, lon, -25.0, 133.0, 13.0, 23.0);

        double monsoonSeason = Math.Max(0.0, Math.Sin(2.0 * Math.PI * (monthIndex - 4) / 12.0));
        double retreatSeason = Math.Max(0.0, Math.Sin(2.0 * Math.PI * (monthIndex - 10) / 12.0));
        double indiaMonsoon = 230.0 * monsoonSeason * Gaussian(lat, lon, 20.0, 78.0, 10.0, 18.0);
        double eastAsiaMonsoon = 110.0 * monsoonSeason * Gaussian(lat, lon, 28.0, 112.0, 12.0, 24.0);
        double westAfricaMonsoon = 95.0 * monsoonSeason * Gaussian(lat, lon, 12.0, -2.0, 9.0, 20.0);
        double australiaWet = 90.0 * retreatSeason * Gaussian(lat, lon, -15.0, 135.0, 11.0, 20.0);
        double southAmericaWet = 70.0 * retreatSeason * Gaussian(lat, lon, -15.0, -55.0, 12.0, 20.0);

        double planetaryWave = 14.0 * (0.5 + 0.5 * Math.Sin((lon - 30.0) * Math.PI / 70.0)) * Math.Exp(-0.5 * Math.Pow(lat / 42.0, 2.0));
        double raw = 48.0 + itcz + midLatitudeStorms + subtropicalDry + amazon + congo + maritime + saharaDry + arabiaDry + atacamaDry + australiaDry + indiaMonsoon + eastAsiaMonsoon + westAfricaMonsoon + australiaWet + southAmericaWet + planetaryWave;
        return Clamp(raw, RainMin, RainMax);
    }

    public static void WriteRaster(string outputPath, string variable, int monthIndex)
    {
        using (Bitmap bitmap = new Bitmap(Width, Height, PixelFormat.Format32bppArgb))
        {
            Rectangle rect = new Rectangle(0, 0, Width, Height);
            BitmapData bitmapData = bitmap.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            int stride = bitmapData.Stride;
            byte[] bytes = new byte[stride * Height];

            for (int y = 0; y < Height; y++)
            {
                double v = Height == 1 ? 0.0 : (double)y / (Height - 1);
                double lat = 90.0 - (v * 180.0);

                for (int x = 0; x < Width; x++)
                {
                    double u = Width == 1 ? 0.0 : (double)x / (Width - 1);
                    double lon = (u * 360.0) - 180.0;
                    double value = variable == "temperature"
                        ? TemperatureValue(lat, lon, monthIndex)
                        : RainfallValue(lat, lon, monthIndex);
                    byte gray = variable == "temperature"
                        ? Normalize(value, TempMin, TempMax)
                        : Normalize(value, RainMin, RainMax);

                    int index = (y * stride) + (x * 4);
                    bytes[index] = gray;
                    bytes[index + 1] = gray;
                    bytes[index + 2] = gray;
                    bytes[index + 3] = 255;
                }
            }

            Marshal.Copy(bytes, 0, bitmapData.Scan0, bytes.Length);
            bitmap.UnlockBits(bitmapData);
            bitmap.Save(outputPath, ImageFormat.Png);
        }
    }
}
"@

$monthLabels = @(
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
)

$metadata = [ordered]@{
  months = $monthLabels
  variables = [ordered]@{
    temperature = [ordered]@{
      id = "temperature"
      label = "Nhiệt độ"
      title = "Nhiệt độ trung bình tháng"
      unit = "°C"
      domain = @(-35, 45)
      paletteStops = @(
        [ordered]@{ position = 0.00; color = "#231c72" }
        [ordered]@{ position = 0.25; color = "#2d6cdf" }
        [ordered]@{ position = 0.50; color = "#72c2ff" }
        [ordered]@{ position = 0.74; color = "#ffd46b" }
        [ordered]@{ position = 1.00; color = "#cb4b2f" }
      )
    }
    rainfall = [ordered]@{
      id = "rainfall"
      label = "Lượng mưa"
      title = "Lượng mưa trung bình tháng"
      unit = "mm"
      domain = @(0, 400)
      paletteStops = @(
        [ordered]@{ position = 0.00; color = "#7b5d3f" }
        [ordered]@{ position = 0.22; color = "#c9a86a" }
        [ordered]@{ position = 0.48; color = "#98d98e" }
        [ordered]@{ position = 0.74; color = "#4fb5d7" }
        [ordered]@{ position = 1.00; color = "#1f5fb7" }
      )
    }
  }
}

$insights = @(
  [ordered]@{
    id = "sahara-heat"
    variable = "temperature"
    lat = 23.5
    lon = 13
    title = "Sahara hấp thụ bức xạ mạnh"
    summary = "Bầu trời quang, nền sa mạc khô và ít mây khiến vùng Sahara nóng lên rất mạnh vào cuối xuân và mùa hè."
    months = @(4, 5, 6, 7, 8, 9)
    priority = 1
  }
  [ordered]@{
    id = "siberia-cold"
    variable = "temperature"
    lat = 62
    lon = 105
    title = "Siberia lạnh sâu vào mùa đông"
    summary = "Biên độ nhiệt lớn trên lục địa khiến miền bắc Á-Âu giảm nhiệt mạnh vào mùa đông Bắc bán cầu."
    months = @(11, 12, 1, 2, 3)
    priority = 1
  }
  [ordered]@{
    id = "india-monsoon"
    variable = "rainfall"
    lat = 20
    lon = 78
    title = "Gió mùa Nam Á tăng mưa mùa hè"
    summary = "Không khí ẩm từ Ấn Độ Dương tràn vào đất liền làm lượng mưa tăng vọt trong giai đoạn gió mùa."
    months = @(6, 7, 8, 9)
    priority = 1
  }
  [ordered]@{
    id = "amazon-basin"
    variable = "rainfall"
    lat = -4
    lon = -62
    title = "Amazon duy trì nền ẩm cao"
    summary = "Rừng mưa nhiệt đới Amazon nằm gần dải hội tụ nhiệt đới nên giữ lượng ẩm cao trong phần lớn năm."
    months = @(1, 2, 3, 4, 5, 10, 11, 12)
    priority = 2
  }
  [ordered]@{
    id = "australia-dry"
    variable = "rainfall"
    lat = -25
    lon = 133
    title = "Nội địa Australia rất khô"
    summary = "Nằm gần đai áp cao cận nhiệt và xa nguồn ẩm lớn, nội địa Australia thường có lượng mưa thấp quanh năm."
    months = @(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
    priority = 2
  }
)

$temperatureDir = Join-Path $OutputRoot "temperature"
$rainfallDir = Join-Path $OutputRoot "rainfall"
New-Item -ItemType Directory -Force -Path $temperatureDir | Out-Null
New-Item -ItemType Directory -Force -Path $rainfallDir | Out-Null

for ($monthIndex = 0; $monthIndex -lt 12; $monthIndex++) {
  $monthName = "{0:D2}.png" -f ($monthIndex + 1)
  [ClimateRasterBuilder]::WriteRaster((Join-Path $temperatureDir $monthName), "temperature", $monthIndex)
  [ClimateRasterBuilder]::WriteRaster((Join-Path $rainfallDir $monthName), "rainfall", $monthIndex)
}

$metadata | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $OutputRoot "metadata.json") -Encoding UTF8
$insights | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $OutputRoot "insights.json") -Encoding UTF8

Write-Host "Climate assets generated at $OutputRoot"
