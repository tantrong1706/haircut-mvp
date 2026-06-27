# Cloud Function API Contracts

All functions are callable HTTPS functions unless noted.

## createSalon

Input:

```json
{
  "name": "Salon Nam",
  "address": "123 Duong A",
  "phone": "0900000000"
}
```

Output:

```json
{ "salonId": "..." }
```

Requires signed-in Firebase owner.

## createStaffProfile

Input:

```json
{
  "salonId": "...",
  "uid": "...",
  "name": "Tho Nam",
  "phone": "0900000001",
  "canRedeemRewards": true
}
```

Requires owner.

## createMirror

Input:

```json
{
  "salonId": "...",
  "name": "Guong so 1"
}
```

Requires owner.

## createManualCustomer

Input:

```json
{
  "salonId": "...",
  "name": "Nguyen Van A",
  "phone": "0900000000",
  "birthday": "1998-01-01",
  "allowPhoto": true
}
```

Output:

```json
{ "customerId": "..." }
```

Requires owner. Use this only when a customer cannot scan QR or does not use Zalo.

## registerCustomerFromZalo

Input:

```json
{
  "salonId": "...",
  "mirrorId": "...",
  "qrToken": "...",
  "zaloUserId": "...",
  "name": "Nguyen Van A",
  "phone": "84900000000",
  "birthday": "1998-01-01",
  "allowPhoto": true
}
```

Output:

```json
{
  "customerId": "...",
  "sessionId": "...",
  "points": 0
}
```

Called from Zalo Mini App. Production version should verify Zalo access token server-side.

## submitPointRequest

Input:

```json
{
  "salonId": "...",
  "sessionId": "...",
  "note": "Fade thap, de mai dai",
  "photoUrls": [],
  "pointsRequested": 1
}
```

Requires staff or owner.

## approvePointRequest

Input:

```json
{ "salonId": "...", "requestId": "..." }
```

Requires owner.

## rejectPointRequest

Input:

```json
{
  "salonId": "...",
  "requestId": "...",
  "reason": "Thong tin chua du"
}
```

Requires owner.

## spinLuckyWheel

Input:

```json
{
  "salonId": "...",
  "customerId": "..."
}
```

Called from Zalo Mini App. Production version should verify the customer identity with Zalo.

## spinLuckyWheelFromZalo

Input:

```json
{
  "salonId": "...",
  "zaloUserId": "..."
}
```

Output:

```json
{
  "rewardId": "...",
  "rewardName": "Goi dau mien phi",
  "rewardCode": "HC-8291",
  "pointsAfter": 0
}
```

MVP customer-facing spin endpoint. Production version should verify Zalo access token server-side.

## getCustomerHistoryFromZalo

Input:

```json
{
  "salonId": "...",
  "zaloUserId": "...",
  "limit": 20
}
```

Output:

```json
{
  "records": [
    {
      "id": "...",
      "createdAtMs": 1782560000000,
      "staffName": "Nam",
      "note": "Fade thap",
      "photoUrls": [],
      "pointsAdded": 1
    }
  ]
}
```

## getCustomerRewardsFromZalo

Input:

```json
{
  "salonId": "...",
  "zaloUserId": "...",
  "limit": 20
}
```

Output:

```json
{
  "rewards": [
    {
      "id": "...",
      "rewardName": "Goi dau mien phi",
      "rewardCode": "HC-8291",
      "status": "unused",
      "createdAtMs": 1782560000000
    }
  ]
}
```

## redeemRewardCode

Input:

```json
{
  "salonId": "...",
  "rewardCode": "HC-8291"
}
```

Requires owner or staff with redemption permission.
