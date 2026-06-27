# Database Design

Use top-level Firestore collections for the MVP. Every business document includes `salonId` so security rules and queries remain simple.

## salons

```text
salons/{salonId}
  name: string
  address: string?
  phone: string?
  ownerId: string
  plan: free | basic | pro | premium
  freeCustomerLimit: number
  pointPerVisit: number
  createdAt: timestamp
  updatedAt: timestamp
```

## users

Firebase Auth users for owner/staff iOS app.

```text
users/{uid}
  salonId: string
  name: string
  phone: string?
  role: owner | staff
  isActive: boolean
  canRedeemRewards: boolean
  createdAt: timestamp
  updatedAt: timestamp
```

## mirrors

```text
mirrors/{mirrorId}
  salonId: string
  name: string
  qrToken: string
  qrUrl: string
  isActive: boolean
  createdAt: timestamp
  updatedAt: timestamp
```

## customers

Customer profiles. Do not call this "customer account" in the UI.

```text
customers/{customerId}
  salonId: string
  zaloUserId: string
  name: string
  phone: string?
  phoneLast4: string?
  birthday: string?
  points: number
  allowPhoto: boolean
  createdAt: timestamp
  updatedAt: timestamp
  lastVisitAt: timestamp?
```

Recommended unique key in Cloud Functions:

```text
customerId = sha256(salonId + ":" + zaloUserId)
```

## chair_sessions

Represents a customer currently sitting at a mirror/chair.

```text
chair_sessions/{sessionId}
  salonId: string
  mirrorId: string
  customerId: string
  status: waiting | serving | completed | cancelled
  createdAt: timestamp
  updatedAt: timestamp
```

## point_requests

```text
point_requests/{requestId}
  salonId: string
  sessionId: string
  customerId: string
  staffId: string
  note: string
  photoUrls: string[]
  pointsRequested: number
  status: pending | approved | rejected
  approvedBy: string?
  rejectedBy: string?
  createdAt: timestamp
  updatedAt: timestamp
```

## haircut_records

```text
haircut_records/{recordId}
  salonId: string
  customerId: string
  staffId: string
  pointRequestId: string
  note: string
  photoUrls: string[]
  pointsAdded: number
  approvedBy: string
  createdAt: timestamp
```

## lucky_wheel

One document per salon, ID equals `salonId`.

```text
lucky_wheel/{salonId}
  salonId: string
  requiredPoints: number
  deductPointsAfterSpin: boolean
  slots:
    - label: string
      active: boolean
  updatedAt: timestamp
```

## reward_history

```text
reward_history/{rewardId}
  salonId: string
  customerId: string
  rewardName: string
  rewardCode: string
  pointsSpent: number
  status: unused | used | expired
  createdAt: timestamp
  usedAt: timestamp?
  usedBy: string?
```

