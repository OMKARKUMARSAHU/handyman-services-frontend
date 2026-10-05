export interface CustomerDto {
  id: string;
  cognitoSub: string;
  name: string;
  phone: string | null;
  email: string | null;
  accountStatus: "active" | "disabled";
}

export interface CustomerRow {
  id: string;
  cognito_sub: string;
  name: string;
  phone: string | null;
  email: string | null;
  account_status: "active" | "disabled";
}

export function toCustomerDto(row: CustomerRow): CustomerDto {
  return {
    id: row.id,
    cognitoSub: row.cognito_sub,
    name: row.name,
    phone: row.phone,
    email: row.email,
    accountStatus: row.account_status,
  };
}
