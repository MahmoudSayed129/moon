# Moon Store — demo

Store management app for Moon Store (inventory, warehouse, point of sale,
invoices & returns, clients, employees and commissions), in Arabic.

This version is **for demonstration only**: there is no database or backend.
All data lives in the browser's `localStorage`, and the app comes pre-filled
with demo products, clients, employees and ~3 months of invoices.

## Run it

```sh
npm install
npm run dev
```

Then open http://localhost:8080.

## Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Super admin (المدير العام) | `admin` | `admin123` |
| Supervisor (مشرف) | `manager` | `manager123` |
| Employee (موظف مبيعات) | `ahmed` | `ahmed123` |
| Employee | `mona` | `mona123` |
| Employee | `youssef` | `youssef123` |

The login screen has one-click buttons for the first three.

## How the local data works

- `src/lib/local-db.ts` — the local store (all tables in one localStorage entry).
- `src/lib/store-operations.ts` — checkout and the 14-day return logic.
- `src/lib/demo-seed.ts` — the demo dataset, generated relative to today so the
  current month always has sales.

Data is per browser and per device: changes you make stay on that machine only.
To start over, use **إعادة ضبط البيانات** on the login screen or
**إعادة ضبط بيانات الديمو** in the admin sidebar.
