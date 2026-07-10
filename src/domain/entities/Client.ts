export type ClientFile = {
  name: string;
  type: string;
  key: string;
  url: string;
};

export type Client = {
  id: number;
  name: string;
  email: string;
  phone: string;
  country: string;
  companyName?: string;
  notes?: string;
  isActive: boolean;
  hasPaid: boolean;
  monthlyAmount?: number;
  paymentDayMonth?: number;
  files?: ClientFile[] | null;
  createdAt?: Date;
  updatedAt?: Date;
};
