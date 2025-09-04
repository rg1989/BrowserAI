# Create a simple PNG icon using .NET
Add-Type -AssemblyName System.Drawing

# Create a 128x128 bitmap
$bitmap = New-Object System.Drawing.Bitmap(128, 128)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# Fill with a blue background
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::DodgerBlue)
$graphics.FillRectangle($brush, 0, 0, 128, 128)

# Add a white circle in the center
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.FillEllipse($whiteBrush, 32, 32, 64, 64)

# Save as PNG
$bitmap.Save("assets/icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Cleanup
$graphics.Dispose()
$bitmap.Dispose()
$brush.Dispose()
$whiteBrush.Dispose()

Write-Host "Icon created successfully"