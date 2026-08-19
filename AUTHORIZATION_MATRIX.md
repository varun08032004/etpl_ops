# PHASE 3 AUTHORIZATION MATRIX & AUDIT
## Current State Analysis (Pre-Fix)

---

## ROLE HIERARCHY (Current)

| Role | Level | Description |
|------|-------|-------------|
| `owner` | 0 (highest) | Full system access, bypasses all checks |
| `admin` | 1 | Near-full access, bypasses most checks |
| `finance` | 2 | Finance module access |
| `hr` | 2 | HR module access |
| `manager` | 2 | Department/team management |
| `employee` | 3 (lowest) | Self-service only |

---

## AUTHORIZATION MECHANICS

### 1. Base Role Check (middleware/auth.js)
- `requireRole(...roles)` passes if: `role in ['owner','admin']` OR `role in allowedRoles` OR `effectiveRoles includes allowedRoles`

### 2. Department-Granted Roles (departmentAccess.js)
- Departments have `granted_roles` array (staff_role[])
- User's department membership → inherits `granted_roles` as `effectiveRoles`
- Resolved per-request in `authenticate()`

### 3. Department Head Check
- `requireDepartmentHead(...deptNames)` checks `departments.head_employee_id`
- Owner/admin bypass

### 4. AI Tool Authorization (aiTools/index.js)
- `validateToolCall()` checks:
  - Read-only vs AI_AGENT access level
  - Role: `allowedRoles.includes('*') || allowedRoles.some(r => userRoles.includes(r))`
  - Department: `allowedDepartments` check against `deptAccess.departmentCodes`

---

## CURRENT AI TOOL PERMISSIONS (PRE-FIX)

### ������ TOOLS WITH `allowedRoles: ['*']` (OVER-PERMISSIONED)

| Tool | Category | Current | Issue |
|------|----------|---------|-------|
| `list_employees` | hr | `['*']` | All authenticated users can list all employees |
| `get_employee` | hr | `['*']` | All users can view any employee (execute filters self) |
| `get_leave_balances` | hr | `['*']` | All users can view any leave balances (execute filters self) |
| `get_attendance` | hr | `['*']` | All users can view any attendance (execute filters self) |
| `create_leave_request` | hr | `['*']` | All users can create leave requests (execute filters self) |
| `list_deals` | sales | `['*']` | All users can list all deals |
| `get_deal` | sales | `['*']` | All users can view any deal |
| `get_sales_forecast` | sales | `['*']` | All users can view sales forecast |
| `create_deal` | sales | `['*']` | All users can create deals |
| `update_deal` | sales | `['*']` | All users can update deals |
| `move_deal_stage` | sales | `['*']` | All users can move deal stages |
| `create_quotation` | sales | `['*']` | All users can create quotations |
| `list_documents` | documents | `['*']` | All users can list documents (execute filters) |
| `get_document` | documents | `['*']` | All users can view documents (execute filters) |
| `upload_document` | documents | `['*']` | All users can upload documents |
| `generate_document` | documents | `['*']` | All users can generate documents |
| `list_generated_docs` | documents | `['*']` | All users can list generated docs |
| `get_company_profile` | settings | `['*']` | All users can view company profile |

### �� PROPERLY RESTRICTED TOOLS

| Tool | Category | allowedRoles | Notes |
|------|----------|--------------|-------|
| `create_employee` | hr | `['hr']` | �� |
| `update_employee` | hr | `['hr']` | �� |
| `exit_employee` | hr | `['hr']` | �� |
| `reinstate_employee` | hr | `['hr']` | �� |
| `decide_leave_request` | hr | `['hr']` | �� |
| `list_job_postings` | hr | `['hr']` | �� |
| `create_job_posting` | hr | `['hr']` | �� |
| `list_candidates` | hr | `['hr']` | �� |
| `create_candidate` | hr | `['hr']` | �� |
| `create_application` | hr | `['hr']` | �� |
| `move_application_stage` | hr | `['hr']` | �� |
| `hire_candidate` | hr | `['hr']` | �� (requiresConfirmation) |
| `manage_interviews` | hr | `['hr']` | �� |
| All finance tools | finance | `['finance']` | �� |
| `mark_deal_won` | sales | `['finance']` | �� (requiresConfirmation) |
| `approve_quotation` | sales | `['finance']` | �� |
| `list_parties` | sales | `['finance']` | �� |
| `get_party` | sales | `['finance']` | �� |
| `approve_generated_doc` | documents | `['admin','hr','finance']` | �� (requiresConfirmation) |
| `void_generated_doc` | documents | `['admin','hr','finance']` | �� (requiresConfirmation, destructive) |
| All settings tools | settings | `['finance']` | �� (except company_profile) |

---

## DEPARTMENT-GRANTED ROLES RISK

**Risk**: A department can grant `finance` or `hr` roles to ALL its members via `granted_roles`. This means:
- An `employee` in Finance department with `granted_roles: ['finance']` gets ALL finance AI tools
- An `employee` in HR department with `granted_roles: ['hr']` gets ALL hr AI tools
- This bypasses the need for actual `finance` or `hr` login role

---

## ROUTE-LEVEL AUTHORIZATION GAPS

### Routes Missing `requireRole` / `requireDepartmentHead`

| Route File | Endpoints | Current Auth | Risk |
|------------|-----------|--------------|------|
| Various | Many GET endpoints | Only `authenticate` | Any authenticated user can access |

### Middleware Gaps

| Check | Location | Issue |
|-------|----------|-------|
| Owner/Admin bypass | `requireRole`, `requireDepartmentHead` | �� Proper |
| Department headship | `requireDepartmentHead` | �� Uses `head_employee_id` |
| Effective roles | `authenticate` + `requireRole` | �� Works |
| AI tool validation | `validateToolCall` | �� Checks role + dept |

---

## IDOR VULNERABILITIES (POTENTIAL)

| Endpoint | Parameter | Check |
|----------|-----------|-------|
| `GET /api/employees/:id` | employee_id | `requireRole('hr')` + execute checks self |
| `GET /api/hr/leave/:id` | leave_id | `requireRole('hr')` + checks manager/dept head |
| AI tools with `employee_id` param | employee_id | Execute-time check only |

---

## FIXES NEEDED (PHASE 3)

### 1. Remove `allowedRoles: ['*']` from AI Tools
- Replace with appropriate role restrictions
- Add execute-time ownership checks where needed

### 2. Restrict Department-Granted Roles
- Limit `granted_roles` to read-only roles only
- Prevent `finance`/`hr` grants via department

### 3. Add Route-Level Authorization
- Audit all routes for missing `requireRole`
- Add department-head checks for sensitive operations

### 4. Implement Real RLS Policies
- Replace placeholder policies with real restrictions
- Enable RLS on all sensitive tables

### 5. Add Authorization Tests
- Test role boundaries
- Test department boundaries
- Test privilege escalation scenarios

---

## PROPOSED ROLE MATRIX (POST-FIX)

| Resource | owner | admin | finance | hr | manager | employee |
|----------|-------|-------|---------|-----|---------|----------|
| **Employees** | | | | | | |
| List all | �� | �� | �� | �� | Dept only | Self only |
| View any | �� | �� | �� | �� | Dept only | Self only |
| View CTC/bank | �� | �� | �� | �� | ��� | Self only |
| Create | �� | �� | ��� | �� | ��� | ��� |
| Update | �� | �� | ��� | �� | ��� | Profile only |
| Exit | �� | �� | ��� | �� | ��� | ��� |
| **Leave** | | | | | | |
| View balances | �� | �� | ��� | �� | Team only | Self only |
| Request | �� | �� | �� | �� | �� | �� (self) |
| Approve | �� | �� | ��� | �� | Team mgr | ��� |
| **Finance** | | | | | | |
| Invoices/Bills | �� | �� | �� | ��� | ��� | ��� |
| Payments | �� | �� | �� | ��� | ��� | ��� |
| Journal entries | �� | �� | �� | ��� | ��� | ��� |
| Payroll | �� | �� | �� | ��� | ��� | Own only |
| **Sales** | | | | | | |
| Deals (read) | �� | �� | �� | ��� | �� | Own only |
| Deals (write) | �� | �� | �� | ��� | �� | ��� |
| Quotations | �� | �� | �� | ��� | �� | ��� |
| **Documents** | | | | | | |
| View (own) | �� | �� | �� | �� | �� | �� |
| View (all) | �� | �� | �� | �� | Dept only | ��� |
| Generate | �� | �� | �� | �� | ��� | Template only |
| Approve/Void | �� | �� | �� | �� | ��� | ��� |
| **AI Tools** | | | | | | |
| Knowledge (read) | �� | �� | �� | �� | �� | �� |
| Actions (write) | �� | �� | Finance only | HR only | ��� | ��� |

---

## NEXT STEPS

1. **Fix AI Tool `allowedRoles: ['*']`** - Replace with proper restrictions
2. **Add Department-Granted Role Restrictions** - Limit to read-only
3. **Audit Route-Level Authorization** - Add missing `requireRole`
4. **Implement Real RLS Policies** - Replace placeholders
5. **Write Authorization Tests** - Test boundaries