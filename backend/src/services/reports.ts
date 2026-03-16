import PDFDocument from 'pdfkit';
import axios from 'axios';

export const generateJobReport = async (job: any, photos: any[]) => {
  // 建立 PDF 實例
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // 標題
  doc.fontSize(24).fillColor('#4F46E5').text('Cleaning Business Pro', { align: 'right' });
  doc.moveDown();
  doc.fontSize(20).fillColor('#111827').text('Job Completion Report', { align: 'left' });
  doc.text('___________________________________________________');
  doc.moveDown();

  // 基本資訊區塊
  doc.fontSize(12).fillColor('#374151');
  doc.text(`Client: ${job.client_name}`, { wordSpacing: 2 });
  doc.text(`Address: ${job.address}`);
  doc.text(`Job Date: ${new Date(job.scheduled_at).toLocaleDateString()}`);
  doc.text(`Status: COMPLETED`);
  doc.moveDown();

  // 檢查清單區塊
  doc.fontSize(16).fillColor('#111827').text('Checklist Summary');
  doc.moveDown(0.5);
  
  if (job.job_checklists && job.job_checklists.length > 0) {
    job.job_checklists.forEach((item: any) => {
      const status = item.is_completed ? '✅' : '❌';
      doc.fontSize(12).fillColor('#4B5563').text(`${status}  ${item.task_name}`);
    });
  } else {
    doc.text('No checklist items recorded.');
  }
  doc.moveDown();

  // 照片證據區塊 (分頁處理)
  doc.fontSize(16).fillColor('#111827').text('Photo Evidence');
  doc.moveDown();

  for (const photo of photos) {
    try {
      // 下載圖片轉為 Buffer
      const response = await axios.get(photo.photo_url, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data);
      
      // 檢查剩餘空間，不夠則自動換頁
      if (doc.y > 600) doc.addPage();
      
      doc.image(imageBuffer, { width: 250 });
      doc.fontSize(10).fillColor('#9CA3AF').text(`Type: ${photo.type.toUpperCase()} | Uploaded: ${new Date(photo.created_at).toLocaleString()}`);
      doc.moveDown(2);
    } catch (e) {
      console.error(`Error embedding image: ${photo.photo_url}`, e);
      doc.fontSize(10).fillColor('red').text(`[Error: Could not load image at ${photo.type}]`);
    }
  }

  doc.end();
  return doc;
};