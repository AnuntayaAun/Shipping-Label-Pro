/**
 * ระบบแยกที่อยู่ภาษาไทยอัจฉริยะ (Smart Thai Address Parser)
 * พยายามดึงข้อมูล ชื่อ, เบอร์โทร, ที่อยู่ และรหัสไปรษณีย์ จากข้อความ
 */
export function parseThaiAddress(input: string) {
  const lines = input.split('\n').filter(line => line.trim() !== '');
  const results = lines.map(line => {
    // 1. ดึงรหัสไปรษณีย์ (ตัวเลข 5 หลัก)
    const postalMatch = line.match(/\b\d{5}\b/);
    const postalCode = postalMatch ? postalMatch[0] : '';

    // 2. ดึงเบอร์โทรศัพท์ (รองรับรูปแบบ 08x-xxx-xxxx, 02-xxx-xxxx ฯลฯ)
    const phoneMatch = line.match(/(0\d{1,2}-?\d{3}-?\d{4}|0\d{1,2}\d{7,8})/);
    const phone = phoneMatch ? phoneMatch[0].replace(/-/g, '') : '';

    // 3. ดึงชื่อ (สมมติว่าเป็นส่วนแรกก่อนตัวเลขหรือช่องว่างยาวๆ)
    const parts = line.split(/[\s,]+/).filter(p => p.trim() !== '');
    let name = parts[0] || '';
    
    // ถ้าคำแรกเป็นคำนำหน้าชื่อ ให้รวมคำถัดไปด้วย
    if (['คุณ', 'นาย', 'นาง', 'นางสาว', 'Ms.', 'Mr.', 'Mrs.'].includes(name) && parts[1]) {
      name += ' ' + parts[1];
    }

    // 4. ที่อยู่คือส่วนที่เหลือทั้งหมด ลบชื่อ เบอร์โทร และรหัสไปรษณีย์ออก
    let address = line
      .replace(name, '')
      .replace(phoneMatch ? phoneMatch[0] : '', '')
      .replace(postalCode, '')
      .trim()
      .replace(/^[,:\s]+|[,:\s]+$/g, '');

    return {
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      postalCode: postalCode.trim(),
    };
  });

  return results;
}

/**
 * ตรวจสอบรูปแบบเบอร์โทรศัพท์ไทย
 */
export function validateThaiPhone(phone: string): boolean {
  return /^0\d{8,9}$/.test(phone.replace(/-/g, ''));
}

/**
 * ตรวจสอบรหัสไปรษณีย์ (5 หลัก)
 */
export function validatePostalCode(code: string): boolean {
  return /^\d{5}$/.test(code);
}
