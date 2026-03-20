/**
 * ข้อมูลสินค้า (Product Information)
 */
export interface Product {
  id: string;
  name: string; // ชื่อสินค้า
  price: number; // ราคา
  quantity: number; // จำนวน
}

/**
 * ข้อมูลผู้รับ (Recipient Information)
 */
export interface Recipient {
  id: string;
  name: string; // ชื่อผู้รับ
  phone: string; // เบอร์โทรศัพท์
  address: string; // ที่อยู่
  postalCode: string; // รหัสไปรษณีย์
  products: Product[]; // รายการสินค้าที่สั่ง
  orderId: string; // หมายเลขคำสั่งซื้อ
  codAmount?: number; // ยอดเงินเก็บเงินปลายทาง (ถ้ามี)
  isSelected?: boolean; // สถานะการเลือกในคิว
}

/**
 * ข้อมูลผู้ส่ง (Sender Information)
 */
export interface SenderInfo {
  name: string; // ชื่อร้านค้า/ผู้ส่ง
  phone: string; // เบอร์โทรศัพท์
  address: string; // ที่อยู่
}

/**
 * ขนาดของใบปะหน้า (Label Sizes)
 */
export type LabelSize = '100x75' | '100x150';
