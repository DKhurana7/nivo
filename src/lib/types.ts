export type Page = 'overview' | 'projects' | 'boq' | 'rates' | 'vendors' | 'enquiries' | 'settings';
export type Category =
  'Joinery' | 'Finishes' | 'Electrical' | 'Plumbing' | 'Furniture' | 'Civil' | 'Other';
export const categories: Category[] = [
  'Joinery',
  'Finishes',
  'Electrical',
  'Plumbing',
  'Furniture',
  'Civil',
  'Other',
];
export const units = ['sq ft', 'sq m', 'r ft', 'm', 'nos', 'sheet', 'set', 'lot', 'Pts'];
export interface Item {
  id: string;
  description: string;
  specification: string;
  category: Category;
  unit: string;
  quantity: number | null;
  quantityKind?: 'measured' | 'rate-only' | 'unknown';
  reference?: string;
  section?: string;
  context?: { row: number; text: string }[];
  sourceRate?: number;
  assembly?: { material: number; labour: number; other: number; adjustment: number };
  markupOverride?: number;
  cost: number | null;
  rateId?: string;
  reviewed: boolean;
  sourceRow?: number;
}
export interface WorkbookMapping {
  sheet: string;
  headerRow: number;
  description: number;
  specification?: number;
  reference?: number;
  quantity: number;
  unit: number;
  rate?: number;
  amount?: number;
}
export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  kind: 'Residential' | 'Commercial';
  stage: 'Draft' | 'In review' | 'Approved';
  createdAt: string;
  dueDate: string;
  markup: number;
  gst: number;
  items: Item[];
  workbookId?: string;
  mapping?: WorkbookMapping;
  demo?: boolean;
  generalNotes?: string;
}
export interface Vendor {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  category: Category;
  location: string;
  notes: string;
  demo?: boolean;
}
export interface Rate {
  id: string;
  description: string;
  specification: string;
  category: Category;
  unit: string;
  cost: number;
  vendorId: string;
  source: 'Vendor quote' | 'Past purchase' | 'Online reference' | 'Manual estimate';
  sourceRef: string;
  quotedAt: string;
  validUntil: string;
  location: string;
  notes: string;
  demo?: boolean;
}
export interface Enquiry {
  id: string;
  projectId: string;
  vendorId: string;
  itemIds: string[];
  status: 'Prepared' | 'Awaiting quote' | 'Quote received';
  createdAt: string;
  notes: string;
  transcript: string;
  quotes?: { itemId: string; rateId: string }[];
}
export interface Settings {
  company: string;
  city: string;
  defaultMarkup: number;
  defaultGst: number;
}
export interface Workspace {
  version: 1;
  settings: Settings;
  projects: Project[];
  vendors: Vendor[];
  rates: Rate[];
  enquiries: Enquiry[];
}
export const uid = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0, 10);
