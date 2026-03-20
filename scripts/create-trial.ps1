# Create CleanFlow trial account (one-liner style — edit the 4 values below then run)
$INTERNAL_SECRET = "YOUR_INTERNAL_API_SECRET"   # 同 Render 嘅 INTERNAL_API_SECRET 一樣
$companyName     = "Test Cleaning Co"
$contactName     = "John Smith"
$email           = "john@example.com"

$body = @{ companyName = $companyName; contactName = $contactName; email = $email; trialDays = 14 } | ConvertTo-Json
$headers = @{ "Content-Type" = "application/json"; "X-Internal-Secret" = $INTERNAL_SECRET }
Invoke-RestMethod -Method POST -Uri "https://cleanflow-backend-8ap3.onrender.com/api/internal/create-trial-account" -Headers $headers -Body $body
