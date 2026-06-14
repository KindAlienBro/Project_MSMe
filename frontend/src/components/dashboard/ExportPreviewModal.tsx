"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  X, Download, Image as ImageIcon, Trash2,
  Palette, FileText, Sparkles, CheckCircle2, Filter
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ───────────────────────────────────────────────────────────────────

type TemplateId = 'professional' | 'classic' | 'colorful';
type ImagePosition = 'header' | 'footer' | 'both';
type CustomTextPosition = 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right';

interface ExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  matrix: Record<string, Record<number, any[]>>;
  headers: string[];
  weekDays: string[];
  breakAfterIndex: number;
  lunchAfterIndex: number;
  selectedSection: string;
  selectedFaculty: string;
  rawGrid?: any;
}

interface TemplateConfig {
  id: TemplateId;
  name: string;
  description: string;
  icon: React.ReactNode;
  preview: {
    headerBg: string;
    headerText: string;
    accent: string;
  };
}

// ─── Template Definitions ────────────────────────────────────────────────────

const TEMPLATES: TemplateConfig[] = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Indigo header, clean grid, subtle row striping',
    icon: <FileText className="w-5 h-5" />,
    preview: { headerBg: 'bg-indigo-600', headerText: 'text-white', accent: 'border-indigo-200' },
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional black & white with bold borders',
    icon: <Palette className="w-5 h-5" />,
    preview: { headerBg: 'bg-gray-800', headerText: 'text-white', accent: 'border-gray-400' },
  },
  {
    id: 'colorful',
    name: 'Colorful',
    description: 'Gradient header, color-coded cells by type',
    icon: <Sparkles className="w-5 h-5" />,
    preview: { headerBg: 'bg-gradient-to-r from-violet-600 to-fuchsia-500', headerText: 'text-white', accent: 'border-violet-200' },
  },
];

// ─── PDF Generation ──────────────────────────────────────────────────────────

function generatePDF(opts: {
  template: TemplateId;
  headerImage: string | null;
  footerImage: string | null;
  imagePosition: ImagePosition;
  customText: string;
  customTextPosition: CustomTextPosition;
  matrix: Record<string, Record<number, any[]>>;
  headers: string[];
  weekDays: string[];
  breakAfterIndex: number;
  lunchAfterIndex: number;
  selectedSection: string;
  selectedFaculty: string;
}): jsPDF {
  const {
    template, headerImage, footerImage, imagePosition, customText, customTextPosition,
    matrix, headers, weekDays,
    breakAfterIndex, lunchAfterIndex,
    selectedSection, selectedFaculty,
  } = opts;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let startY = 10;

  // ─── Header Image ──────────────────────────────────────
  const showHeaderImage = headerImage && (imagePosition === 'header' || imagePosition === 'both');
  if (showHeaderImage) {
    try {
      const imgProps = doc.getImageProperties(headerImage!);
      
      const maxWidth = pageWidth - 28; // 14mm margins on each side
      const maxHeight = 35; // Maximum reasonable height for a header

      const widthRatio = maxWidth / imgProps.width;
      const heightRatio = maxHeight / imgProps.height;
      
      // Scale to fit within the bounding box
      const scale = Math.min(widthRatio, heightRatio);
      
      const finalWidth = imgProps.width * scale;
      const finalHeight = imgProps.height * scale;
      
      // Center the image
      const imgX = (pageWidth - finalWidth) / 2;
      doc.addImage(headerImage!, 'AUTO', imgX, startY, finalWidth, finalHeight);
      startY += finalHeight + 6;
    } catch {
      // If image fails, skip it
    }
  }

  // ─── Title ─────────────────────────────────────────────
  const title = selectedSection
    ? `Timetable — Section ${selectedSection}`
    : selectedFaculty
      ? `Timetable — ${selectedFaculty}`
      : 'Timetable';

  const dateStr = `Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  if (template === 'professional') {
    // Draw title bar
    doc.setFillColor(67, 56, 202);
    doc.rect(0, startY, pageWidth, 14, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, 14, startY + 9);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr, pageWidth - 14, startY + 9, { align: 'right' });
    doc.setTextColor(0);
    startY += 18;
  } else if (template === 'classic') {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(title, pageWidth / 2, startY + 8, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(dateStr, pageWidth / 2, startY + 14, { align: 'center' });
    doc.setTextColor(0);
    // Underline
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(14, startY + 17, pageWidth - 14, startY + 17);
    startY += 22;
  } else {
    // Colorful — gradient-like header bar
    doc.setFillColor(124, 58, 237);
    doc.rect(0, startY, pageWidth * 0.6, 14, 'F');
    doc.setFillColor(217, 70, 239);
    doc.rect(pageWidth * 0.6, startY, pageWidth * 0.4, 14, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, 14, startY + 9);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr, pageWidth - 14, startY + 9, { align: 'right' });
    doc.setTextColor(0);
    startY += 18;
  }

  // ─── Custom Text (Top) ─────────────────────────────────
  let customTextLines: string[] = [];
  let customTextHeight = 0;
  
  if (customText && customText.trim() !== '') {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    customTextLines = doc.splitTextToSize(customText, pageWidth - 28);
    customTextHeight = customTextLines.length * 4.5; // Approx 4.5mm per line

    if (customTextPosition.startsWith('top')) {
      doc.setTextColor(50);
      let textX = 14;
      let align: 'left' | 'center' | 'right' = 'left';
      
      if (customTextPosition === 'top-center') {
        textX = pageWidth / 2;
        align = 'center';
      } else if (customTextPosition === 'top-right') {
        textX = pageWidth - 14;
        align = 'right';
      }
      
      doc.text(customTextLines, textX, startY + 2, { align });
      startY += customTextHeight + 6;
    }
  }

  // ─── Build Table Data ──────────────────────────────────
  const breakHeaderIdx = breakAfterIndex + 1;
  const lunchHeaderIdx = lunchAfterIndex + 2;

  const tableHead = [['DAY', ...headers]];

  const tableBody: any[][] = [];
  let maxLinesInCell = 0;

  weekDays.forEach((day: string, dayIndex: number) => {
    const row: any[] = [day.substring(0, 3).toUpperCase()];
    let periodCounter = 0;
    headers.forEach((_h: string, hi: number) => {
      if (hi === breakHeaderIdx) {
        if (dayIndex === 0) {
          row.push({
            content: 'B\nR\nE\nA\nK',
            rowSpan: weekDays.length,
            styles: { halign: 'center', valign: 'middle', fillColor: [240, 245, 250], textColor: [100, 110, 140], fontStyle: 'bold' }
          });
        }
        return;
      }
      
      if (hi === lunchHeaderIdx) {
        if (dayIndex === 0) {
          row.push({
            content: 'L\nU\nN\nC\nH',
            rowSpan: weekDays.length,
            styles: { halign: 'center', valign: 'middle', fillColor: [240, 245, 250], textColor: [100, 110, 140], fontStyle: 'bold' }
          });
        }
        return;
      }

      const classes = matrix[day]?.[periodCounter] || [];
      periodCounter++;
      if (classes.length === 0) {
        row.push('');
      } else {
        const cellText = classes.map((cls: any) => {
          let line = (cls.subject || '').toUpperCase();
          if (cls.batch) line += ` [${cls.batch}]`;
          line += `\n${cls.faculty || ''}`;
          if (cls.room) line += ` | ${cls.room}`;
          return line;
        }).join('\n------\n');
        
        const linesCount = cellText.split('\n').length;
        if (linesCount > maxLinesInCell) maxLinesInCell = linesCount;
        
        row.push(cellText);
      }
    });
    tableBody.push(row);
  });

  // ─── Adaptive Sizing ─────────────────────────────────────
  let smartFontSize = 7;
  let smartCellPadding = 2;
  
  if (maxLinesInCell >= 12) {
    smartFontSize = 5;
    smartCellPadding = 0.5;
  } else if (maxLinesInCell >= 8) {
    smartFontSize = 5.5;
    smartCellPadding = 1;
  } else if (maxLinesInCell >= 5) {
    smartFontSize = 6;
    smartCellPadding = 1;
  }

  // ─── Template-specific Table Styles ────────────────────
  let tableConfig: any = {};

  if (template === 'professional') {
    tableConfig = {
      theme: 'grid',
      styles: {
        fontSize: smartFontSize, cellPadding: smartCellPadding, valign: 'middle',
        lineColor: [200, 200, 220], lineWidth: 0.3, overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [67, 56, 202], textColor: [255, 255, 255],
        fontStyle: 'bold', fontSize: smartFontSize + 0.5, halign: 'center', cellPadding: 2
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 16, fillColor: [238, 238, 255] },
      },
      bodyStyles: { halign: 'center' },
      alternateRowStyles: { fillColor: [248, 248, 255] },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index > 0 && data.cell.raw) {
          const raw = String(data.cell.raw);
          if (raw.includes('LAB')) {
            data.cell.styles.fillColor = [237, 247, 255];
          }
        }
      },
    };
  } else if (template === 'classic') {
    tableConfig = {
      theme: 'grid',
      styles: {
        fontSize: smartFontSize, cellPadding: smartCellPadding, valign: 'middle',
        lineColor: [0, 0, 0], lineWidth: 0.4, textColor: [0, 0, 0], overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [30, 30, 30], textColor: [255, 255, 255],
        fontStyle: 'bold', fontSize: smartFontSize + 0.5, halign: 'center', cellPadding: 2
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 16, fillColor: [240, 240, 240] },
      },
      bodyStyles: { halign: 'center' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    };
  } else {
    // Colorful
    tableConfig = {
      theme: 'grid',
      styles: {
        fontSize: smartFontSize, cellPadding: smartCellPadding, valign: 'middle',
        lineColor: [180, 160, 220], lineWidth: 0.25, overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [124, 58, 237], textColor: [255, 255, 255],
        fontStyle: 'bold', fontSize: smartFontSize + 0.5, halign: 'center', cellPadding: 2
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 16, fillColor: [250, 245, 255] },
      },
      bodyStyles: { halign: 'center' },
      alternateRowStyles: { fillColor: [252, 248, 255] },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index > 0 && data.cell.raw) {
          const raw = String(data.cell.raw);
          if (raw.includes('LAB')) {
            data.cell.styles.fillColor = [240, 253, 244];
            data.cell.styles.textColor = [21, 128, 61];
          } else if (raw && raw.trim() !== '') {
            data.cell.styles.fillColor = [238, 242, 255];
            data.cell.styles.textColor = [55, 48, 163];
          }
        }
      },
    };
  }

  // ─── Render Table ──────────────────────────────────────
  // Smartly calculate min cell height to use available vertical space
  const availableTableHeight = pageHeight - startY - 25; // 25mm bottom margin / footer space
  const rowCount = weekDays.length + 1; // data rows + header row
  // Calculate height, clamping between 8mm (min) and 25mm (max) to avoid absurdly huge cells
  const calculatedMinCellHeight = Math.min(Math.max(availableTableHeight / rowCount, 8), 25);
  
  if (tableConfig.styles) {
    tableConfig.styles.minCellHeight = calculatedMinCellHeight;
  } else {
    tableConfig.styles = { minCellHeight: calculatedMinCellHeight };
  }

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY,
    rowPageBreak: 'avoid',
    margin: { bottom: 5 },
    ...tableConfig,
  });

  // ─── Custom Text (Bottom) ──────────────────────────────
  if (customText && customText.trim() !== '' && customTextPosition.startsWith('bottom')) {
    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    
    let textX = 14;
    let align: 'left' | 'center' | 'right' = 'left';
    
    if (customTextPosition === 'bottom-center') {
      textX = pageWidth / 2;
      align = 'center';
    } else if (customTextPosition === 'bottom-right') {
      textX = pageWidth - 14;
      align = 'right';
    }
    
doc.text(customTextLines, textX, finalY, { align });
  }


  // ─── Footer Image ──────────────────────────────────────
  const showFooterImage = footerImage && (imagePosition === 'footer' || imagePosition === 'both');
  if (showFooterImage) {
    try {
      const imgProps = doc.getImageProperties(footerImage!);
      
      const maxWidth = pageWidth - 28;
      const maxHeight = 25; // Footer usually smaller

      const widthRatio = maxWidth / imgProps.width;
      const heightRatio = maxHeight / imgProps.height;
      
      // Scale to fit within the bounding box
      const scale = Math.min(widthRatio, heightRatio);
      
      const finalWidth = imgProps.width * scale;
      const finalHeight = imgProps.height * scale;
      
      const imgX = (pageWidth - finalWidth) / 2;
      const imgY = pageHeight - finalHeight - 8;
      doc.addImage(footerImage!, 'AUTO', imgX, imgY, finalWidth, finalHeight);
    } catch {
      // If image fails, skip it
    }
  }

  return doc;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ExportPreviewModal({
  isOpen, onClose,
  matrix, headers, weekDays,
  breakAfterIndex, lunchAfterIndex,
  selectedSection, selectedFaculty,
  rawGrid
}: ExportPreviewModalProps) {
  const [template, setTemplate] = useState<TemplateId>('professional');
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const [footerImage, setFooterImage] = useState<string | null>(null);
  const [headerThumb, setHeaderThumb] = useState<string | null>(null);
  const [footerThumb, setFooterThumb] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState<ImagePosition>('header');
  const [customText, setCustomText] = useState('');
  const [customTextPosition, setCustomTextPosition] = useState<CustomTextPosition>('bottom-center');
  const [generating, setGenerating] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  const headerInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);

  const [localSection, setLocalSection] = useState<string>(selectedSection === "Version" ? "" : selectedSection);
  const [localFaculty, setLocalFaculty] = useState<string>(selectedFaculty);

  // Sync props to local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSection(selectedSection === "Version" ? "" : selectedSection);
      setLocalFaculty(selectedFaculty);
    }
  }, [isOpen, selectedSection, selectedFaculty]);

  const allSections = useMemo(() => {
    if (!rawGrid) return [];
    return Object.keys(rawGrid).sort();
  }, [rawGrid]);

  const allFaculties = useMemo(() => {
    if (!rawGrid) return [];
    const faculties = new Set<string>();
    Object.values(rawGrid).forEach((secObj: any) => {
      Object.values(secObj.slots).forEach((dayObj: any) => {
        Object.values(dayObj).forEach((slotItems: any) => {
          slotItems.forEach((item: any) => {
            if (item.faculty) faculties.add(item.faculty);
          });
        });
      });
    });
    return Array.from(faculties).sort();
  }, [rawGrid]);

  const computedMatrix = useMemo(() => {
    if (!rawGrid) return matrix;

    const m: Record<string, Record<number, any[]>> = {};
    weekDays.forEach(d => m[d] = {});

    const matchFaculty = localFaculty !== '';
    const matchSection = localSection !== '';

    Object.keys(rawGrid).forEach(sectionId => {
      if (matchSection && sectionId !== localSection) return;

      const sectionData = rawGrid[sectionId];
      const sectionDays: number[] = sectionData.days || [];
      
      sectionDays.forEach(dayIdx => {
        const dayName = weekDays[dayIdx];
        if (!dayName) return;
        
        const daySlots = sectionData.slots[String(dayIdx)] || {};
        let periodCounter = 0;
        
        const breakHeaderIdx = breakAfterIndex + 1;
        const lunchHeaderIdx = lunchAfterIndex + 2;

        headers.forEach((h: string, hi: number) => {
          if (hi === breakHeaderIdx || hi === lunchHeaderIdx) return;
          
          const currentPeriod = periodCounter;
          const cells = daySlots[String(periodCounter)] || [];
          periodCounter++;
          
          cells.forEach((cell: any) => {
            if (matchFaculty && cell.faculty !== localFaculty) return;

            if (!m[dayName][currentPeriod]) {
              m[dayName][currentPeriod] = [];
            }
            
            const existing = m[dayName][currentPeriod].find(
              (c: any) => c.subject === cell.subject && c.faculty === cell.faculty
            );
            
            if (existing) {
              if (!existing.section.includes(sectionId)) {
                existing.section += `, ${sectionId}`;
              }
            } else {
              m[dayName][currentPeriod].push({
                ...cell,
                subject: cell.subject,
                faculty: cell.faculty,
                room: cell.room,
                section: sectionId,
                period_index: currentPeriod,
                time_slot: h
              });
            }
          });
        });
      });
    });
    
    return m;
  }, [rawGrid, matrix, weekDays, headers, breakAfterIndex, lunchAfterIndex, localSection, localFaculty]);

  // Generate preview whenever settings change
  const generatePreview = useCallback(() => {
    if (!isOpen) return;
    setGenerating(true);

    setTimeout(() => {
      try {
        const doc = generatePDF({
          template, headerImage, footerImage, imagePosition, customText, customTextPosition,
          matrix: computedMatrix, headers, weekDays,
          breakAfterIndex, lunchAfterIndex,
          selectedSection: localSection,
          selectedFaculty: localFaculty,
        });

        const blobUrl = doc.output('bloburl') as unknown as string;

        if (prevUrlRef.current) {
          URL.revokeObjectURL(prevUrlRef.current);
        }
        prevUrlRef.current = blobUrl;
        setPreviewUrl(blobUrl);
      } catch (e) {
        console.error('PDF generation error:', e);
      }
      setGenerating(false);
    }, 100);
  }, [isOpen, template, headerImage, footerImage, imagePosition, customText, customTextPosition, computedMatrix, headers, weekDays, breakAfterIndex, lunchAfterIndex, localSection, localFaculty]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
      }
    };
  }, []);

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'header' | 'footer') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPEG, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (target === 'header') {
        setHeaderImage(base64);
        setHeaderThumb(base64);
      } else {
        setFooterImage(base64);
        setFooterThumb(base64);
      }
    };
    reader.readAsDataURL(file);

    // Reset the input so the same file can be re-selected
    e.target.value = '';
  };

  const handleDownload = () => {
    try {
      const doc = generatePDF({
        template,
        headerImage,
        footerImage,
        imagePosition,
        customText,
        customTextPosition,
        matrix: computedMatrix,
        headers,
        weekDays,
        breakAfterIndex,
        lunchAfterIndex,
        selectedSection: localSection,
        selectedFaculty: localFaculty,
      });
      doc.save(`timetable-${localSection || localFaculty || 'all'}.pdf`);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[95vw] max-w-7xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Export Timetable</h2>
            <p className="text-sm text-gray-500 mt-0.5">Choose a template, add your logo, and preview before downloading</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Panel — Settings */}
          <div className="w-80 flex-shrink-0 border-r border-gray-100 overflow-y-auto p-5 space-y-6 bg-white">
            
            {/* Filtering (Only if rawGrid is provided, i.e., Generator View) */}
            {rawGrid && (
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-indigo-500" />
                  Filter Timetable
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Section</label>
                    <select
                      value={localSection}
                      onChange={(e) => { setLocalSection(e.target.value); setLocalFaculty(''); }}
                      className="w-full text-sm rounded-lg border-gray-200 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">All Sections</option>
                      {allSections.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Faculty</label>
                    <select
                      value={localFaculty}
                      onChange={(e) => { setLocalFaculty(e.target.value); setLocalSection(''); }}
                      className="w-full text-sm rounded-lg border-gray-200 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">All Faculties</option>
                      {allFaculties.map(fac => <option key={fac} value={fac}>{fac}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Template Selection */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-500" />
                Template
              </h3>
              <div className="space-y-2">
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200 ${
                      template === t.id
                        ? 'border-indigo-500 bg-indigo-50/60 shadow-sm'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Mini preview bar */}
                      <div className={`w-8 h-8 rounded-lg ${t.preview.headerBg} flex items-center justify-center ${t.preview.headerText}`}>
                        {t.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                          {template === t.id && <CheckCircle2 className="w-4 h-4 text-indigo-500" />}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{t.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-500" />
                Logo / Image
              </h3>

              {/* Position selector */}
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Position</label>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  {(['header', 'footer', 'both'] as ImagePosition[]).map(pos => (
                    <button
                      key={pos}
                      onClick={() => setImagePosition(pos)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
                        imagePosition === pos
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* Header image upload */}
              {(imagePosition === 'header' || imagePosition === 'both') && (
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Header Image</label>
                  <input
                    ref={headerInputRef}
                    type="file"
                    accept="image/*"
                    onChange={e => handleImageUpload(e, 'header')}
                    className="hidden"
                  />
                  {headerThumb ? (
                    <div className="relative group">
                      <img src={headerThumb} alt="Header" className="w-full h-16 object-contain bg-gray-50 rounded-lg border border-gray-200 p-1" />
                      <button
                        onClick={() => { setHeaderImage(null); setHeaderThumb(null); }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => headerInputRef.current?.click()}
                      className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2"
                    >
                      <ImageIcon className="w-4 h-4" />
                      Upload Header Image
                    </button>
                  )}
                </div>
              )}

              {/* Footer image upload */}
              {(imagePosition === 'footer' || imagePosition === 'both') && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Footer Image</label>
                  <input
                    ref={footerInputRef}
                    type="file"
                    accept="image/*"
                    onChange={e => handleImageUpload(e, 'footer')}
                    className="hidden"
                  />
                  {footerThumb ? (
                    <div className="relative group">
                      <img src={footerThumb} alt="Footer" className="w-full h-16 object-contain bg-gray-50 rounded-lg border border-gray-200 p-1" />
                      <button
                        onClick={() => { setFooterImage(null); setFooterThumb(null); }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => footerInputRef.current?.click()}
                      className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2"
                    >
                      <ImageIcon className="w-4 h-4" />
                      Upload Footer Image
                    </button>
                  )}
                </div>
              )}

              <p className="text-[10px] text-gray-400 mt-2">Supports PNG, JPEG. Max 5MB.</p>
            </div>

            {/* Custom Text Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  Custom Text
                </h3>
                {customText.trim() !== '' && (
                  <select
                    value={customTextPosition}
                    onChange={(e) => setCustomTextPosition(e.target.value as CustomTextPosition)}
                    className="text-xs bg-gray-50 border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-indigo-500"
                  >
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="top-left">Top Left</option>
                    <option value="top-center">Top Center</option>
                    <option value="top-right">Top Right</option>
                  </select>
                )}
              </div>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Add notes, signatures, or extra info..."
                rows={3}
                className="w-full text-xs p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
              />
            </div>
          </div>

          {/* Right Panel — Preview */}
          <div className="flex-1 flex flex-col min-h-0 bg-gray-100/60">
            <div className="px-5 py-3 border-b border-gray-200/80 flex items-center justify-between flex-shrink-0">
              <span className="text-sm font-semibold text-gray-700">Live Preview</span>
              {generating && (
                <span className="text-xs text-indigo-500 animate-pulse flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                  Generating...
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 p-4">
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full rounded-xl border border-gray-200 bg-white shadow-inner"
                  title="PDF Preview"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">Generating preview...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex-shrink-0">
          <p className="text-xs text-gray-400">
            {selectedSection ? `Section ${selectedSection}` : selectedFaculty || 'All sections'} · Landscape A4
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
