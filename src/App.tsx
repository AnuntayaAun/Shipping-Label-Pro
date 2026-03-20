import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Plus, 
  Trash2, 
  FileUp, 
  Printer, 
  Download, 
  Settings as SettingsIcon, 
  CheckCircle2, 
  AlertCircle,
  Package,
  Users,
  LayoutDashboard,
  X,
  Copy,
  Check,
  Sparkles,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { cn } from './lib/utils';
import { parseThaiAddress, validateThaiPhone, validatePostalCode } from './lib/parser';
import { Product, Recipient, SenderInfo, LabelSize } from './types';

export default function App() {
  // --- สถานะ (State) ---
  const [recipients, setRecipients] = useState<Recipient[]>([]); // รายชื่อผู้รับในคิว
  const [products, setProducts] = useState<Product[]>([]); // รายการสินค้าเริ่มต้น
  const [sender, setSender] = useState<SenderInfo>({
    name: 'ชื่อร้านค้าของคุณ',
    phone: '0812345678',
    address: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110'
  });
  const [labelSize, setLabelSize] = useState<LabelSize>('100x150'); // ขนาดใบปะหน้า
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard'); // แท็บที่ใช้งานอยู่
  const [rawInput, setRawInput] = useState(''); // ข้อมูลที่วางในช่องข้อความ
  const [isPrinting, setIsPrinting] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false); // สถานะการโหลดของ AI
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null); // ID ของผู้รับที่กำลังแก้ไขสินค้า

  // สถานะฟอร์มสำหรับเพิ่มสินค้าใหม่
  const [newProduct, setNewProduct] = useState({ name: '', price: 0, quantity: 1 });

  const [isExportingList, setIsExportingList] = useState(false);

  // --- ผลกระทบ (Effects) ---
  // โหลดข้อมูลจาก LocalStorage เมื่อเปิดแอป
  useEffect(() => {
    const saved = localStorage.getItem('shipping_label_pro_data');
    if (saved) {
      const { recipients, products, sender, labelSize } = JSON.parse(saved);
      setRecipients(recipients || []);
      setProducts(products || []);
      setSender(sender || { name: '', phone: '', address: '' });
      setLabelSize(labelSize || '100x150');
    }
  }, []);

  // บันทึกข้อมูลลง LocalStorage เมื่อมีการเปลี่ยนแปลง
  useEffect(() => {
    localStorage.setItem('shipping_label_pro_data', JSON.stringify({
      recipients, products, sender, labelSize
    }));
  }, [recipients, products, sender, labelSize]);

  // --- ฟังก์ชันจัดการ (Handlers) ---
  // เพิ่มสินค้าลงในรายการเริ่มต้น
  const handleAddProduct = () => {
    if (!newProduct.name) return;
    const product: Product = {
      id: Math.random().toString(36).substr(2, 9),
      ...newProduct
    };
    setProducts([...products, product]);
    setNewProduct({ name: '', price: 0, quantity: 1 });
  };

  // ลบสินค้าออกจากรายการเริ่มต้น
  const handleRemoveProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  // แยกข้อมูลที่อยู่ด้วยระบบมาตรฐาน
  const handleParseData = () => {
    if (!rawInput.trim()) return;
    const parsed = parseThaiAddress(rawInput);
    const newRecipients: Recipient[] = parsed.map(p => ({
      id: Math.random().toString(36).substr(2, 9),
      ...p,
      products: [...products], // แนบสินค้าปัจจุบันไปยังผู้รับแต่ละคน
      orderId: 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      isSelected: true
    }));
    setRecipients([...recipients, ...newRecipients]);
    setRawInput('');
  };

  // แยกข้อมูลที่อยู่ด้วย AI (Gemini)
  const handleAiAssist = async () => {
    if (!rawInput.trim()) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: `ช่วยแยกข้อมูลที่อยู่ภาษาไทยต่อไปนี้ให้อยู่ในรูปแบบ JSON array ของ objects ที่มี keys: name, phone, address, postalCode. 
        ตรวจสอบให้แน่ใจว่าเบอร์โทรศัพท์อยู่ในรูปแบบ 08XXXXXXXX และรหัสไปรษณีย์มี 5 หลัก
        ข้อมูลนำเข้า:
        ${rawInput}`,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const parsed = JSON.parse(response.text);
      const newRecipients: Recipient[] = parsed.map((p: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: p.name || '',
        phone: p.phone || '',
        address: p.address || '',
        postalCode: p.postalCode || '',
        products: [...products],
        orderId: 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        isSelected: true
      }));
      setRecipients([...recipients, ...newRecipients]);
      setRawInput('');
    } catch (error) {
      console.error('AI Error:', error);
      alert('การแยกข้อมูลด้วย AI ล้มเหลว กำลังสลับไปใช้ระบบแยกข้อมูลมาตรฐาน');
      handleParseData();
    } finally {
      setIsAiLoading(false);
    }
  };

  // นำเข้าไฟล์ (Excel, CSV, JSON)
  const handleImportFile = (files: File[]) => {
    const file = files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        processImportedJson(json);
      } else if (file.name.endsWith('.csv')) {
        Papa.parse(file, {
          header: true,
          complete: (results) => processImportedJson(results.data),
        });
      } else if (file.name.endsWith('.json')) {
        processImportedJson(JSON.parse(data as string));
      }
    };

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  // ประมวลผลข้อมูล JSON ที่นำเข้า
  const processImportedJson = (data: any[]) => {
    const newRecipients: Recipient[] = data.map(item => ({
      id: Math.random().toString(36).substr(2, 9),
      name: item.name || item.Name || item['ชื่อ'] || '',
      phone: (item.phone || item.Phone || item['เบอร์โทร'] || '').toString(),
      address: item.address || item.Address || item['ที่อยู่'] || '',
      postalCode: (item.postalCode || item.PostalCode || item['รหัสไปรษณีย์'] || '').toString(),
      products: [...products],
      orderId: item.orderId || 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      isSelected: true
    }));
    setRecipients([...recipients, ...newRecipients]);
  };

  // เลือกทั้งหมด / ยกเลิกเลือกทั้งหมด
  const toggleSelectAll = () => {
    const allSelected = recipients.every(r => r.isSelected);
    setRecipients(recipients.map(r => ({ ...r, isSelected: !allSelected })));
  };

  // ลบรายการที่เลือก
  const handleRemoveSelected = () => {
    setRecipients(recipients.filter(r => !r.isSelected));
  };

  // สั่งพิมพ์ใบปะหน้า
  const handlePrint = () => {
    if (recipients.filter(r => r.isSelected).length === 0) {
      alert('กรุณาเลือกผู้รับอย่างน้อย 1 รายการ');
      return;
    }
    window.print();
  };

  // สั่งพิมพ์ใบรายการ (Packing List)
  const handlePrintList = () => {
    const selectedRecipients = recipients.filter(r => r.isSelected);
    if (selectedRecipients.length === 0) {
      alert('กรุณาเลือกผู้รับอย่างน้อย 1 รายการ');
      return;
    }

    // สร้างหน้าต่างใหม่สำหรับพิมพ์ใบรายการ
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <html>
        <head>
          <title>Packing List - ${new Date().toLocaleDateString('th-TH')}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Prompt', sans-serif; padding: 20px; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 12px; }
            th { background-color: #f8fafc; font-weight: 700; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #4f46e5; padding-bottom: 15px; margin-bottom: 25px; }
            .title { font-size: 24px; font-weight: 800; color: #4f46e5; margin: 0; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 15px; }
            .cod { color: #e11d48; font-weight: 700; }
            .total-row { background-color: #f8fafc; font-weight: 800; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">ใบรายการสินค้า (Packing List)</h1>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;">วันที่: ${new Date().toLocaleDateString('th-TH')}</p>
            </div>
            <div style="text-align: right;">
              <p style="font-weight: 700; margin: 0;">${sender.name}</p>
              <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">Tel: ${sender.phone}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 25%;">ผู้รับ</th>
                <th style="width: 45%;">รายการสินค้า</th>
                <th style="width: 10%; text-align: right;">COD</th>
                <th style="width: 15%; text-align: right;">ยอดรวม</th>
              </tr>
            </thead>
            <tbody>
              ${selectedRecipients.map((r, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>
                    <div style="font-weight: 700;">${r.name}</div>
                    <div style="font-size: 10px; color: #64748b;">${r.postalCode}</div>
                  </td>
                  <td>
                    ${r.products.map(p => `
                      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span>${p.name} x${p.quantity}</span>
                        <span style="color: #94a3b8;">฿${(p.price * p.quantity).toLocaleString()}</span>
                      </div>
                    `).join('')}
                  </td>
                  <td style="text-align: right;" class="cod">
                    ${r.codAmount ? `฿${r.codAmount.toLocaleString()}` : '-'}
                  </td>
                  <td style="text-align: right; font-weight: 700;">
                    ฿${calculateRecipientTotal(r).toLocaleString()}
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="4" style="text-align: right; padding: 15px 12px;">ยอดรวมทั้งหมด (${selectedRecipients.length} รายการ)</td>
                <td style="text-align: right; padding: 15px 12px; color: #4f46e5;">
                  ฿${selectedRecipients.reduce((sum, r) => sum + calculateRecipientTotal(r), 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>

          <div class="footer">
            เอกสารนี้สร้างโดยระบบ Shipping Label Pro เมื่อวันที่ ${new Date().toLocaleString('th-TH')}
          </div>

          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  const calculateRecipientTotal = (recipient: Recipient) => {
    return recipient.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
  };

  // อัปเดตสินค้าในผู้รับที่ระบุ
  const handleUpdateRecipientProducts = (recipientId: string, updatedProducts: Product[]) => {
    setRecipients(recipients.map(r => 
      r.id === recipientId ? { ...r, products: updatedProducts } : r
    ));
  };

  // ส่งออกใบรายการ (Packing List) เป็น PDF
  const handleExportListPDF = async () => {
    const selectedRecipients = recipients.filter(r => r.isSelected);
    if (selectedRecipients.length === 0) {
      alert('กรุณาเลือกผู้รับอย่างน้อย 1 รายการ');
      return;
    }

    setIsExportingList(true);

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const exportContainer = document.getElementById('pdf-export-container');
      if (!exportContainer) {
        setIsExportingList(false);
        return;
      }

      // เรนเดอร์ใบรายการ (Packing List)
      exportContainer.innerHTML = `
        <div style="width: 210mm; padding: 20mm; background: white; color: black; font-family: 'Prompt', sans-serif; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #4f46e5; padding-bottom: 15px; margin-bottom: 25px;">
            <div>
              <h1 style="font-size: 28px; font-weight: 800; margin: 0; color: #4f46e5;">ใบรายการสินค้า (Packing List)</h1>
              <p style="font-size: 14px; color: #64748b; margin: 5px 0 0 0;">วันที่: ${new Date().toLocaleDateString('th-TH')}</p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 16px; font-weight: 700; margin: 0;">${sender.name}</p>
              <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">Tel: ${sender.phone}</p>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <th style="text-align: left; padding: 12px 8px; font-weight: 700; width: 5%;">#</th>
                <th style="text-align: left; padding: 12px 8px; font-weight: 700; width: 25%;">ผู้รับ (Recipient)</th>
                <th style="text-align: left; padding: 12px 8px; font-weight: 700; width: 45%;">รายการสินค้า (Items)</th>
                <th style="text-align: right; padding: 12px 8px; font-weight: 700; width: 10%;">COD</th>
                <th style="text-align: right; padding: 12px 8px; font-weight: 700; width: 15%;">ยอดรวม</th>
              </tr>
            </thead>
            <tbody>
              ${selectedRecipients.map((r, idx) => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 8px; vertical-align: top;">${idx + 1}</td>
                  <td style="padding: 12px 8px; vertical-align: top;">
                    <p style="font-weight: 700; margin: 0;">${r.name}</p>
                    <p style="font-size: 10px; color: #64748b; margin: 2px 0 0 0;">${r.postalCode}</p>
                  </td>
                  <td style="padding: 12px 8px; vertical-align: top;">
                    ${r.products.map(p => `
                      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span>${p.name} x${p.quantity}</span>
                        <span style="color: #94a3b8;">฿${(p.price * p.quantity).toLocaleString()}</span>
                      </div>
                    `).join('')}
                  </td>
                  <td style="padding: 12px 8px; vertical-align: top; text-align: right; color: #e11d48; font-weight: 700;">
                    ${r.codAmount ? `฿${r.codAmount.toLocaleString()}` : '-'}
                  </td>
                  <td style="padding: 12px 8px; vertical-align: top; text-align: right; font-weight: 700;">
                    ฿${calculateRecipientTotal(r).toLocaleString()}
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-weight: 800; font-size: 14px;">
                <td colspan="4" style="padding: 15px 8px; text-align: right;">ยอดรวมทั้งหมด (${selectedRecipients.length} รายการ)</td>
                <td style="padding: 15px 8px; text-align: right; color: #4f46e5;">
                  ฿${selectedRecipients.reduce((sum, r) => sum + calculateRecipientTotal(r), 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 20px; text-align: center; color: #94a3b8; font-size: 10px;">
            เอกสารนี้สร้างโดยระบบ Shipping Label Pro เมื่อวันที่ ${new Date().toLocaleString('th-TH')}
          </div>
        </div>
      `;

      // รอให้เบราว์เซอร์เรนเดอร์ HTML เล็กน้อย
      await new Promise(resolve => setTimeout(resolve, 200));

      // แปลง HTML เป็น Image
      const imgData = await toPng(exportContainer, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 210 * 3.78, // A4 width in px
        cacheBust: true,
      });

      // เพิ่มรูปลงใน PDF (A4)
      const imgProps = doc.getImageProperties(imgData);
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      doc.save(`packing_list_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error('List PDF Export Error:', error);
      alert('เกิดข้อผิดพลาดในการสร้างใบรายการ PDF');
    } finally {
      setIsExportingList(false);
      const exportContainer = document.getElementById('pdf-export-container');
      if (exportContainer) exportContainer.innerHTML = '';
    }
  };

  // ส่งออกเป็น PDF (รองรับภาษาไทยด้วย html-to-image)
  const handleExportPDF = async () => {
    const selectedRecipients = recipients.filter(r => r.isSelected);
    if (selectedRecipients.length === 0) {
      alert('กรุณาเลือกผู้รับอย่างน้อย 1 รายการ');
      return;
    }

    setIsPrinting(true);

    try {
      const width = 100; // mm
      const height = labelSize === '100x150' ? 150 : 75; // mm
      
      const doc = new jsPDF({
        orientation: labelSize === '100x150' ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [width, height]
      });

      const exportContainer = document.getElementById('pdf-export-container');
      if (!exportContainer) {
        setIsPrinting(false);
        return;
      }

      for (let i = 0; i < selectedRecipients.length; i++) {
        const recipient = selectedRecipients[i];
        const total = calculateRecipientTotal(recipient);
        
        // แปลง mm เป็น px สำหรับการเรนเดอร์ (96 DPI: 1mm = 3.78px)
        const pxWidth = width * 3.78;
        const pxHeight = height * 3.78;
        const pxPadding = 10 * 3.78;

        // ล้างข้อมูลเก่าและใส่ข้อมูลใหม่ลงใน container ลับ
        exportContainer.innerHTML = `
          <div style="width: ${pxWidth}px; height: ${pxHeight}px; padding: ${pxPadding}px; background: white; color: black; font-family: 'Prompt', sans-serif; display: flex; flex-direction: column; border: 1px solid #eee; box-sizing: border-box; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 15px;">
              <div style="flex: 1;">
                <p style="font-size: 10px; font-weight: bold; margin: 0 0 4px 0; color: #666; text-transform: uppercase; letter-spacing: 1px;">ผู้ส่ง (FROM)</p>
                <p style="font-size: 14px; font-weight: bold; margin: 0 0 4px 0;">${sender.name}</p>
                <p style="font-size: 12px; margin: 0 0 4px 0; line-height: 1.4; color: #333;">${sender.address}</p>
                <p style="font-size: 12px; font-weight: bold; margin: 0;">Tel: ${sender.phone}</p>
              </div>
              <div style="text-align: right; flex-shrink: 0; margin-left: 15px;">
                <div style="background: #000; color: #fff; padding: 8px 16px; font-size: 13px; font-weight: bold; border-radius: 4px;">
                  SHIPPING LABEL
                </div>
                <p style="font-size: 9px; font-family: monospace; margin-top: 8px; color: #999;">${recipient.orderId}</p>
              </div>
            </div>
            
            <div style="flex: 1;">
              <p style="font-size: 10px; font-weight: bold; margin: 0 0 8px 0; color: #666; text-transform: uppercase; letter-spacing: 1px;">ผู้รับ (SHIP TO)</p>
              <p style="font-size: 24px; font-weight: bold; margin: 0 0 8px 0; line-height: 1.1;">${recipient.name}</p>
              <p style="font-size: 16px; margin: 0 0 12px 0; line-height: 1.4; color: #000;">${recipient.address}</p>
              <p style="font-size: 16px; font-weight: bold; margin: 0;">Tel: ${recipient.phone}</p>
            </div>
            
            <div style="margin-top: auto; border-top: 2px solid #000; padding-top: 15px;">
              <p style="font-size: 10px; font-weight: bold; margin: 0 0 12px 0; color: #666; text-transform: uppercase; letter-spacing: 1px;">รายการสินค้า (ORDER DETAILS)</p>
              <table style="width: 100%; font-size: 12px; border-collapse: collapse; margin-bottom: 15px;">
                <thead>
                  <tr style="border-bottom: 1.5px solid #000; background: #f9fafb;">
                    <th style="text-align: left; padding: 8px 4px; font-weight: bold;">รายการ</th>
                    <th style="text-align: center; padding: 8px 4px; font-weight: bold; width: 15%;">จำนวน</th>
                    <th style="text-align: right; padding: 8px 4px; font-weight: bold; width: 20%;">ราคา/หน่วย</th>
                    <th style="text-align: right; padding: 8px 4px; font-weight: bold; width: 20%;">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  ${recipient.products.map(p => `
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 10px 4px; color: #333;">${p.name}</td>
                      <td style="text-align: center; padding: 10px 4px;">${p.quantity}</td>
                      <td style="text-align: right; padding: 10px 4px;">฿${p.price.toLocaleString()}</td>
                      <td style="text-align: right; padding: 10px 4px; font-weight: 500;">฿${(p.price * p.quantity).toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="padding: 12px 4px 4px; font-weight: bold; text-align: right; font-size: 13px;">รวมทั้งหมด (TOTAL)</td>
                    <td style="text-align: right; padding: 12px 4px 4px; font-weight: bold; font-size: 16px; color: #000;">฿${total.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
              
              <div style="display: flex; justify-content: space-between; align-items: flex-end; background: #fff; padding-top: 8px;">
                <div style="flex: 1;">
                  ${recipient.codAmount ? `
                    <div style="display: inline-block; border: 2px solid #e11d48; padding: 8px 16px; border-radius: 4px;">
                      <p style="font-size: 10px; font-weight: bold; margin: 0; color: #e11d48; text-transform: uppercase;">เก็บเงินปลายทาง (COD)</p>
                      <p style="font-size: 20px; font-weight: 900; margin: 0; color: #e11d48;">฿${recipient.codAmount.toLocaleString()}</p>
                    </div>
                  ` : ''}
                </div>
                <div style="text-align: right;">
                  <p style="font-size: 48px; font-weight: 900; margin: 0; letter-spacing: -2px; line-height: 0.8; color: #000;">${recipient.postalCode}</p>
                </div>
              </div>
            </div>
          </div>
        `;

        // รอให้เบราว์เซอร์เรนเดอร์ HTML เล็กน้อย
        await new Promise(resolve => setTimeout(resolve, 100));

        // แปลง HTML เป็น Image ด้วย html-to-image
        const imgData = await toPng(exportContainer, {
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          width: pxWidth,
          height: pxHeight,
          cacheBust: true,
          style: {
            opacity: '1',
            visibility: 'visible'
          }
        });
        
        if (i > 0) doc.addPage([width, height], labelSize === '100x150' ? 'portrait' : 'landscape');
        doc.addImage(imgData, 'PNG', 0, 0, width, height);
      }

      doc.save(`shipping_labels_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('เกิดข้อผิดพลาดในการสร้าง PDF กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsPrinting(false);
      const exportContainer = document.getElementById('pdf-export-container');
      if (exportContainer) exportContainer.innerHTML = '';
    }
  };

  // ส่งออกเป็น CSV (Excel)
  const handleExportCSV = () => {
    const selectedRecipients = recipients.filter(r => r.isSelected);
    if (selectedRecipients.length === 0) return;

    // ส่วนหัวของไฟล์ CSV
    const headers = ['Order ID', 'Recipient Name', 'Phone', 'Address', 'Postal Code', 'COD Amount', 'Items'];
    
    // ข้อมูลแต่ละแถว
    const rows = selectedRecipients.map(r => [
      r.orderId,
      r.name,
      r.phone,
      r.address,
      r.postalCode,
      r.codAmount || 0,
      r.products.map(p => `${p.name} x${p.quantity}`).join('; ')
    ]);

    // รวมส่วนหัวและข้อมูล
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // สร้าง Blob และดาวน์โหลด (เพิ่ม BOM เพื่อให้ Excel อ่านภาษาไทยได้)
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `shipping_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ส่งออกข้อมูลทั้งหมด (JSON Backup)
  const handleBackupAll = () => {
    const fullData = {
      sender,
      recipients,
      products,
      labelSize,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipping_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => handleImportFile(acceptedFiles),
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/json': ['.json']
    }
  } as any);

  const selectedCount = recipients.filter(r => r.isSelected).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Package className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
            Shipping Label Pro
          </h1>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2",
              activeTab === 'dashboard' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2",
              activeTab === 'settings' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            <SettingsIcon size={18} />
            Settings
          </button>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {activeTab === 'dashboard' ? (
          <>
            {/* แผงด้านซ้าย (LEFT PANEL) */}
            <div className="lg:col-span-7 space-y-6">
              {/* ส่วนจัดการสินค้า (Product Input Section) */}
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-6">
                  <Package className="text-indigo-600" size={20} />
                  <h2 className="font-semibold text-lg">จัดการสินค้า (Product Management)</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ชื่อสินค้า</label>
                    <input 
                      type="text" 
                      placeholder="เช่น เสื้อยืด XL"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      value={newProduct.name}
                      onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ราคา (฿)</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      value={newProduct.price || ''}
                      onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">จำนวนต่อใบปะหน้า</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        placeholder="1"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        value={newProduct.quantity || ''}
                        onChange={e => setNewProduct({...newProduct, quantity: Number(e.target.value)})}
                      />
                      <button 
                        onClick={handleAddProduct}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-200 active:scale-95 flex items-center justify-center"
                      >
                        <Plus size={24} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <AnimatePresence>
                    {products.map(p => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        key={p.id} 
                        className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 group"
                      >
                        <span className="text-sm font-medium">{p.name} (x{p.quantity})</span>
                        <button 
                          onClick={() => handleRemoveProduct(p.id)} 
                          className="text-indigo-400 hover:text-rose-500 transition-all duration-200 hover:bg-rose-50 p-1 rounded-md active:scale-90"
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {products.length === 0 && (
                    <p className="text-sm text-slate-400 italic">No products added. Labels will only contain addresses.</p>
                  )}
                  {products.length > 0 && recipients.some(r => r.isSelected) && (
                    <button 
                      onClick={() => {
                        setRecipients(recipients.map(r => 
                          r.isSelected ? { ...r, products: [...products] } : r
                        ));
                      }}
                      className="ml-auto text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-all duration-200 hover:bg-indigo-100 active:scale-95"
                    >
                      <CheckCircle2 size={14} />
                      นำรายการนี้ไปใช้กับผู้รับที่เลือก ({recipients.filter(r => r.isSelected).length})
                    </button>
                  )}
                </div>
              </section>

              {/* ส่วนนำเข้าข้อมูลผู้รับ (Recipient Input Section) */}
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Users className="text-indigo-600" size={20} />
                    <h2 className="font-semibold text-lg">ข้อมูลผู้รับ (Recipient Data)</h2>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setRawInput('')}
                      className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-all duration-200 uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100 active:scale-95"
                    >
                      ล้างข้อมูล (Clear All)
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <textarea 
                    placeholder="วางที่อยู่ตรงนี้...&#10;ตัวอย่าง:&#10;สมชาย ใจดี 081-234-5678 123/4 สุขุมวิท กรุงเทพ 10110&#10;สมหญิง รักเรียน 099-888-7777 55 พระราม 9 กรุงเทพ 10310"
                    className="w-full h-40 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none font-mono text-sm"
                    value={rawInput}
                    onChange={e => setRawInput(e.target.value)}
                  />
                  
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={handleParseData}
                      disabled={!rawInput.trim() || isAiLoading}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <CheckCircle2 size={20} />
                      แยกที่อยู่ (Parse)
                    </button>

                    <button 
                      onClick={handleAiAssist}
                      disabled={!rawInput.trim() || isAiLoading}
                      className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      {isAiLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                      ใช้ AI ช่วยแยกข้อมูล
                    </button>
                    
                    <div {...getRootProps()} className={cn(
                      "flex-1 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all",
                      isDragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50"
                    )}>
                      <input {...getInputProps()} />
                      <FileUp size={20} className="text-slate-400" />
                      <span className="text-sm font-semibold text-slate-500">นำเข้าไฟล์ (Excel/CSV)</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* ตารางรายการผู้รับ (Recipient Table Section) */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 text-white p-2 rounded-lg">
                      <Users size={18} />
                    </div>
                    <div>
                      <h2 className="font-bold">รายการจัดส่ง ({recipients.length})</h2>
                      <p className="text-xs text-slate-500">จัดการข้อมูลและเลือกรายการที่ต้องการพิมพ์</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={toggleSelectAll}
                      className={cn(
                        "px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-200 active:scale-95",
                        recipients.length > 0 && recipients.every(r => r.isSelected) 
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200 hover:shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:shadow-sm'
                      )}
                    >
                      {recipients.length > 0 && recipients.every(r => r.isSelected) ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'}
                    </button>
                    <button 
                      onClick={handleRemoveSelected}
                      disabled={selectedCount === 0}
                      className="px-4 py-2 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl border border-rose-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 hover:shadow-lg hover:shadow-rose-100 active:scale-95"
                    >
                      ลบที่เลือก ({selectedCount})
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="p-4 w-12">
                          <input 
                            type="checkbox" 
                            checked={recipients.length > 0 && recipients.every(r => r.isSelected)}
                            onChange={toggleSelectAll}
                            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                          />
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">ชื่อผู้รับ (Name)</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">เบอร์โทร (Phone)</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">ที่อยู่ (Address)</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">รหัสไปรษณีย์ (Postal)</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">ราคารวม (Total)</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">เก็บเงินปลายทาง (COD ฿)</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">สถานะ (Status)</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recipients.map(r => {
                        const isPhoneValid = validateThaiPhone(r.phone);
                        const isPostalValid = validatePostalCode(r.postalCode);
                        const isValid = isPhoneValid && isPostalValid && r.name && r.address;
                        const total = calculateRecipientTotal(r);

                        return (
                          <tr key={r.id} className={cn(
                            "group hover:bg-slate-50/50 transition-colors",
                            r.isSelected ? "bg-indigo-50/30" : ""
                          )}>
                            <td className="p-4">
                              <input 
                                type="checkbox" 
                                checked={r.isSelected}
                                onChange={() => setRecipients(recipients.map(item => item.id === r.id ? { ...item, isSelected: !item.isSelected } : item))}
                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                              />
                            </td>
                            <td className="p-4 font-medium text-sm">{r.name || <span className="text-red-400 italic">ไม่มีชื่อ</span>}</td>
                            <td className="p-4 text-sm font-mono">{r.phone || <span className="text-red-400 italic">ไม่มีเบอร์โทร</span>}</td>
                            <td className="p-4 text-sm max-w-xs truncate">{r.address || <span className="text-red-400 italic">ไม่มีที่อยู่</span>}</td>
                            <td className="p-4 text-sm font-mono">{r.postalCode || <span className="text-red-400 italic">ไม่มีรหัส</span>}</td>
                            <td className="p-4 text-sm font-bold text-indigo-600">฿{total.toLocaleString()}</td>
                            <td className="p-4">
                              <input 
                                type="number" 
                                className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500"
                                value={r.codAmount || ''}
                                onChange={e => setRecipients(recipients.map(item => item.id === r.id ? { ...item, codAmount: Number(e.target.value) } : item))}
                                placeholder="0"
                              />
                            </td>
                            <td className="p-4">
                              {isValid ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                  <Check size={12} /> พร้อมพิมพ์
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                  <AlertCircle size={12} /> ไม่สมบูรณ์
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <button 
                                onClick={() => setEditingRecipientId(r.id)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200 active:scale-90"
                                title="แก้ไขสินค้า"
                              >
                                <Package size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {recipients.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center">
                            <div className="flex flex-col items-center gap-2 text-slate-400">
                              <Users size={40} strokeWidth={1.5} />
                              <p className="text-sm">ยังไม่มีข้อมูลผู้รับในรายการ วางที่อยู่หรือนำเข้าไฟล์เพื่อเริ่มต้น</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* แผงด้านขวา - ตัวอย่างและปุ่มควบคุม (RIGHT PANEL - PREVIEW & CONTROLS) */}
            <div className="lg:col-span-5 space-y-6">
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 sticky top-24">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-semibold text-lg">ตัวอย่างใบปะหน้า (Print Preview)</h2>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                      onClick={() => setLabelSize('100x75')}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 active:scale-95",
                        labelSize === '100x75' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-white/50"
                      )}
                    >
                      100x75
                    </button>
                    <button 
                      onClick={() => setLabelSize('100x150')}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 active:scale-95",
                        labelSize === '100x150' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-white/50"
                      )}
                    >
                      100x150
                    </button>
                  </div>
                </div>

                {/* พื้นที่แสดงตัวอย่าง (Preview Area) */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6 flex justify-center">
                  <div 
                    className={cn(
                      "bg-white shadow-xl border border-slate-200 p-6 flex flex-col overflow-hidden transition-all duration-300",
                      labelSize === '100x75' ? "w-[300px] h-[225px]" : "w-[300px] h-[450px]"
                    )}
                    id="label-preview"
                  >
                    {selectedCount > 0 ? (
                      <div className="flex flex-col h-full text-[10px] leading-tight">
                        {/* ผู้ส่ง (Sender) */}
                        <div className="border-b border-slate-200 pb-2 mb-2">
                          <p className="font-bold text-slate-400 uppercase tracking-widest text-[8px] mb-1">ผู้ส่ง (From)</p>
                          <p className="font-bold text-xs">{sender.name}</p>
                          <p className="text-slate-600 line-clamp-2">{sender.address}</p>
                          <p className="font-medium">Tel: {sender.phone}</p>
                        </div>

                        {/* ผู้รับ (Receiver) */}
                        <div className="flex-1">
                          <p className="font-bold text-slate-400 uppercase tracking-widest text-[8px] mb-1">ผู้รับ (Ship To)</p>
                          <p className="font-bold text-lg leading-tight mb-1">{recipients.find(r => r.isSelected)?.name}</p>
                          <p className="text-sm text-slate-700 mb-2 leading-snug">{recipients.find(r => r.isSelected)?.address}</p>
                          <p className="text-sm font-bold">Tel: {recipients.find(r => r.isSelected)?.phone}</p>
                        </div>

                        {/* รหัสไปรษณีย์และส่วนท้าย (Postal Code & Footer) */}
                        <div className="mt-auto pt-2 border-t border-slate-200">
                          <div className="space-y-1.5">
                            <p className="font-bold text-slate-400 uppercase tracking-widest text-[7px]">รายการสินค้า</p>
                            <div className="max-h-32 overflow-y-auto">
                              <table className="w-full text-[8px] border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-100 text-slate-400">
                                    <th className="text-left py-0.5">รายการ</th>
                                    <th className="text-center py-0.5">จำนวน</th>
                                    <th className="text-right py-0.5">รวม</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {recipients.find(r => r.isSelected)?.products.map(p => (
                                    <tr key={p.id} className="border-b border-slate-50">
                                      <td className="py-0.5 truncate max-w-[80px]">{p.name}</td>
                                      <td className="text-center py-0.5">{p.quantity}</td>
                                      <td className="text-right py-0.5">฿{(p.price * p.quantity).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="font-bold text-indigo-600">
                                    <td colSpan={2} className="text-right py-1">รวมทั้งหมด</td>
                                    <td className="text-right py-1 text-[10px]">฿{calculateRecipientTotal(recipients.find(r => r.isSelected)!).toLocaleString()}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                            
                            <div className="flex justify-between items-end pt-1">
                              <p className="text-[7px] font-mono text-slate-400">{recipients.find(r => r.isSelected)?.orderId}</p>
                              <div className="text-right">
                                {recipients.find(r => r.isSelected)?.codAmount ? (
                                  <p className="text-[9px] font-bold text-red-600 leading-none mb-1">COD: ฿{recipients.find(r => r.isSelected)?.codAmount.toLocaleString()}</p>
                                ) : null}
                                <p className="text-3xl font-black tracking-tighter text-indigo-600 leading-none">{recipients.find(r => r.isSelected)?.postalCode}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                        <Printer size={32} strokeWidth={1} />
                        <p className="text-xs font-medium">เลือกผู้รับเพื่อดูตัวอย่าง</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handlePrint}
                    disabled={selectedCount === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <Printer size={20} />
                    พิมพ์ใบปะหน้า ({selectedCount})
                  </button>
                  <button 
                    onClick={handlePrintList}
                    disabled={selectedCount === 0}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <Printer size={20} />
                    พิมพ์ใบรายการ ({selectedCount})
                  </button>
                  <button 
                    onClick={handleExportPDF}
                    disabled={selectedCount === 0 || isPrinting}
                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] hover:shadow-sm"
                  >
                    {isPrinting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                    {isPrinting ? 'กำลังสร้าง PDF...' : 'ส่งออกใบปะหน้า (PDF)'}
                  </button>
                  <button 
                    onClick={handleExportListPDF}
                    disabled={selectedCount === 0 || isExportingList}
                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] hover:shadow-sm"
                  >
                    {isExportingList ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
                    {isExportingList ? 'กำลังสร้างใบรายการ...' : 'ส่งออกใบรายการ (PDF)'}
                  </button>
                  <button 
                    onClick={handleExportCSV}
                    disabled={selectedCount === 0}
                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] hover:shadow-sm"
                  >
                    <FileUp size={18} />
                    ส่งออก CSV
                  </button>
                  <button 
                    onClick={handleBackupAll}
                    disabled={recipients.length === 0}
                    className="col-span-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <Copy size={18} />
                    สำรองข้อมูลทั้งหมด (JSON)
                  </button>
                </div>
              </section>
            </div>
          </>
        ) : (
          /* แท็บตั้งค่า (SETTINGS TAB) */
          <div className="lg:col-span-8 lg:col-start-3 space-y-6">
            <section className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                  <SettingsIcon size={24} />
                </div>
                <div>
                  <h2 className="font-bold text-xl">ตั้งค่าผู้ส่ง (Sender Settings)</h2>
                  <p className="text-sm text-slate-500">กำหนดข้อมูลร้านค้าของคุณสำหรับใบปะหน้า</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">ชื่อร้าน / ชื่อผู้ส่ง</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      value={sender.name}
                      onChange={e => setSender({...sender, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">เบอร์โทรศัพท์</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      value={sender.phone}
                      onChange={e => setSender({...sender, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">ที่อยู่เต็ม</label>
                  <textarea 
                    className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                    value={sender.address}
                    onChange={e => setSender({...sender, address: e.target.value})}
                  />
                </div>
                
                <div className="pt-6 border-t border-slate-100 flex justify-end">
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-200 active:scale-95"
                  >
                    บันทึกการเปลี่ยนแปลง
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* พื้นที่พิมพ์ที่ซ่อนอยู่ (Hidden Print Area) */}
      <div id="pdf-export-container" style={{ 
        position: 'fixed', 
        left: '-9999px', 
        top: '-9999px', 
        zIndex: -1, 
        opacity: 1, 
        pointerEvents: 'none',
        backgroundColor: 'white'
      }}></div>

      {/* Modal แก้ไขสินค้า (Edit Products Modal) */}
      <AnimatePresence>
        {editingRecipientId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingRecipientId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">แก้ไขรายการสินค้า</h3>
                    <p className="text-sm text-slate-500">
                      สำหรับ: {recipients.find(r => r.id === editingRecipientId)?.name}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingRecipientId(null)}
                  className="p-2 hover:bg-white rounded-full transition-all duration-200 text-slate-400 hover:text-rose-500 active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="space-y-4">
                  {recipients.find(r => r.id === editingRecipientId)?.products.map((p, idx) => (
                    <div key={p.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex-1">
                        <input 
                          type="text" 
                          value={p.name}
                          onChange={e => {
                            const currentRecipient = recipients.find(r => r.id === editingRecipientId);
                            if (!currentRecipient) return;
                            const newProducts = [...currentRecipient.products];
                            newProducts[idx].name = e.target.value;
                            handleUpdateRecipientProducts(editingRecipientId, newProducts);
                          }}
                          className="w-full bg-transparent font-semibold outline-none focus:text-indigo-600"
                          placeholder="ชื่อสินค้า"
                        />
                      </div>
                      <div className="w-24">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">ราคา</label>
                        <input 
                          type="number" 
                          value={p.price || ''}
                          onChange={e => {
                            const currentRecipient = recipients.find(r => r.id === editingRecipientId);
                            if (!currentRecipient) return;
                            const newProducts = [...currentRecipient.products];
                            newProducts[idx].price = Number(e.target.value);
                            handleUpdateRecipientProducts(editingRecipientId, newProducts);
                          }}
                          className="w-full bg-transparent font-mono outline-none focus:text-indigo-600"
                          placeholder="0"
                        />
                      </div>
                      <div className="w-20">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">จำนวน</label>
                        <input 
                          type="number" 
                          value={p.quantity || ''}
                          onChange={e => {
                            const currentRecipient = recipients.find(r => r.id === editingRecipientId);
                            if (!currentRecipient) return;
                            const newProducts = [...currentRecipient.products];
                            newProducts[idx].quantity = Number(e.target.value);
                            handleUpdateRecipientProducts(editingRecipientId, newProducts);
                          }}
                          className="w-full bg-transparent font-mono outline-none focus:text-indigo-600"
                          placeholder="1"
                        />
                      </div>
                      <button 
                        onClick={() => {
                          const currentRecipient = recipients.find(r => r.id === editingRecipientId);
                          if (!currentRecipient) return;
                          const newProducts = currentRecipient.products.filter((_, i) => i !== idx);
                          handleUpdateRecipientProducts(editingRecipientId, newProducts);
                        }}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-all duration-200 hover:bg-rose-50 rounded-lg active:scale-90"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}

                  <button 
                    onClick={() => {
                      const currentRecipient = recipients.find(r => r.id === editingRecipientId);
                      if (!currentRecipient) return;
                      const newProduct: Product = {
                        id: Math.random().toString(36).substr(2, 9),
                        name: 'สินค้าใหม่',
                        price: 0,
                        quantity: 1
                      };
                      handleUpdateRecipientProducts(editingRecipientId, [...currentRecipient.products, newProduct]);
                    }}
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-all duration-200 font-semibold flex items-center justify-center gap-2 active:scale-[0.99]"
                  >
                    <Plus size={20} />
                    เพิ่มสินค้าใหม่
                  </button>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-slate-500">ราคารวมทั้งหมด:</span>
                  <span className="ml-2 font-bold text-xl text-indigo-600">
                    ฿{calculateRecipientTotal(recipients.find(r => r.id === editingRecipientId)!).toLocaleString()}
                  </span>
                </div>
                <button 
                  onClick={() => setEditingRecipientId(null)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-200 active:scale-95"
                >
                  เสร็จสิ้น
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="hidden print:block bg-white font-sans">
        {recipients.filter(r => r.isSelected).map((r, idx) => (
          <div 
            key={r.id} 
            className={cn(
              "border border-black p-8 flex flex-col break-after-page",
              labelSize === '100x75' ? "w-[100mm] h-[75mm]" : "w-[100mm] h-[150mm]"
            )}
          >
            {/* ผู้ส่ง (Sender) */}
            <div className="border-b-2 border-black pb-4 mb-4">
              <p className="font-bold text-[10px] uppercase mb-1 text-slate-500">ผู้ส่ง (FROM)</p>
              <p className="font-bold text-lg">{sender.name}</p>
              <p className="text-sm leading-tight">{sender.address}</p>
              <p className="text-sm font-bold mt-1">Tel: {sender.phone}</p>
            </div>

            {/* ผู้รับ (Receiver) */}
            <div className="flex-1">
              <p className="font-bold text-[10px] uppercase mb-1 text-slate-500">ผู้รับ (SHIP TO)</p>
              <p className="font-bold text-3xl mb-2 leading-none">{r.name}</p>
              <p className="text-xl leading-snug mb-4">{r.address}</p>
              <p className="text-xl font-bold">Tel: {r.phone}</p>
            </div>

            {/* ส่วนท้าย (Footer) */}
            <div className="mt-auto pt-4 border-t-2 border-black">
              <p className="font-bold text-[10px] uppercase mb-2 text-slate-500">รายการสินค้า (ITEMS)</p>
              <table className="w-full text-[11px] border-collapse mb-4">
                <thead>
                  <tr className="border-b border-black bg-slate-50">
                    <th className="text-left py-1 px-1">รายการ</th>
                    <th className="text-center py-1 px-1">จำนวน</th>
                    <th className="text-right py-1 px-1">ราคา/หน่วย</th>
                    <th className="text-right py-1 px-1">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {r.products.map(p => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-1 px-1">{p.name}</td>
                      <td className="text-center py-1 px-1">{p.quantity}</td>
                      <td className="text-right py-1 px-1">฿{p.price.toLocaleString()}</td>
                      <td className="text-right py-1 px-1 font-semibold">฿{(p.price * p.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={3} className="text-right py-2">รวมทั้งหมด (TOTAL)</td>
                    <td className="text-right py-2 text-xl">฿{calculateRecipientTotal(r).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-mono text-slate-400">{r.orderId}</p>
                </div>
                <div className="text-right">
                  {r.codAmount ? (
                    <div className="border-2 border-black p-2 mb-2 inline-block">
                      <p className="text-[10px] font-bold uppercase leading-none mb-1">เก็บเงินปลายทาง (COD)</p>
                      <p className="text-3xl font-black leading-none">฿{r.codAmount.toLocaleString()}</p>
                    </div>
                  ) : null}
                  <p className="text-7xl font-black leading-none tracking-tighter">{r.postalCode}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
