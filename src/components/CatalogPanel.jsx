import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { BookOpen, Search, Plus, Save, Edit2, Trash2, Loader2, RefreshCw, X, Upload, Download, FileText, DollarSign, ShieldAlert, Filter, ArrowUpDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';

const CatalogPanel = ({ user }) => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const fileInputRef = useRef(null);
  
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  
  const [selectedCategories, setSelectedCategories] = useState([]);

  const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'asc' });

  const canEditCatalog = user?.role === 'Administrador' || user?.role === 'Producción';
  const isReadOnly = !canEditCatalog; 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [formData, setFormData] = useState({ 
      codigo: '', categoria: '', nombre: '', descripcion: '', observaciones: '', 
      venta_minima: '0', 
      precios_escalonados: [{ cantidad: '0', precio: '', es_base: true }],
      tienePrecioDistribuidor: false, 
      precios_distribuidor: [],
      es_por_metro: false 
  });
  
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCatalog(activeSearchTerm); }, [activeSearchTerm]);

  const fetchCatalog = async (searchTerm = '') => {
    setLoading(true);
    try {
      let query = supabase.from('catalogo_productos').select('*');
      if (searchTerm) query = query.or(`nombre.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%`);
      query = query.limit(1000); 

      const { data, error } = await query;
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cargar el catálogo", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSearchKeyDown = (e) => { if (e.key === 'Enter') setActiveSearchTerm(searchInput); };

  const uniqueCategories = React.useMemo(() => {
      const categories = items.map(item => item.categoria).filter(Boolean);
      return [...new Set(categories)].sort();
  }, [items]);

  const toggleCategory = (cat) => {
      setSelectedCategories(prev => 
          prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
      );
  };

  const requestSort = (key) => {
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const processedItems = React.useMemo(() => {
      let filtered = items.filter(item => {
          if (selectedCategories.length === 0) return true;
          return selectedCategories.includes(item.categoria);
      });

      filtered.sort((a, b) => {
          const aVal = a[sortConfig.key];
          const bVal = b[sortConfig.key];

          if (aVal === bVal) return 0;
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;

          if (typeof aVal === 'number' && typeof bVal === 'number') {
              return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
          }

          const aStr = String(aVal).toLowerCase();
          const bStr = String(bVal).toLowerCase();

          if (sortConfig.direction === 'asc') {
              return aStr.localeCompare(bStr);
          }
          return bStr.localeCompare(aStr);
      });

      return filtered;
  }, [items, selectedCategories, sortConfig]);

  const SortableHeader = ({ label, sortKey, align = 'left', width }) => (
      <th 
          className={`px-4 py-3 font-semibold cursor-pointer hover:bg-slate-700 transition-colors select-none ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'} ${width ? width : ''}`} 
          onClick={() => requestSort(sortKey)}
      >
          <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
              {label}
              <ArrowUpDown className={`h-3 w-3 ${sortConfig.key === sortKey ? 'text-purple-400 font-bold' : 'text-slate-400'}`} />
          </div>
      </th>
  );

  const handleOpenModal = (item = null) => {
    if (isReadOnly) return;
    if (item) {
        setEditingItem(item);
        
        let loadedTiers = item.precios_escalonados || [];
        if (!loadedTiers.some(t => Number(t.precio) === Number(item.precio))) {
             loadedTiers = [{ cantidad: item.venta_minima || 0, precio: item.precio || 0, es_base: true }, ...loadedTiers];
        } else {
             let foundBase = false;
             loadedTiers = loadedTiers.map(t => {
                 if (!foundBase && Number(t.precio) === Number(item.precio)) {
                     foundBase = true;
                     return { ...t, es_base: true };
                 }
                 return { ...t, es_base: false };
             });
        }
        if (loadedTiers.length > 0 && !loadedTiers.some(t => t.es_base)) loadedTiers[0].es_base = true;

        let loadedDistTiers = item.precios_distribuidor || [];
        const hasDistribuidorConfig = Number(item.precio_distribuidor) > 0 || loadedDistTiers.length > 0;
        
        if (hasDistribuidorConfig) {
             if (!loadedDistTiers.some(t => Number(t.precio) === Number(item.precio_distribuidor))) {
                  loadedDistTiers = [{ cantidad: item.venta_minima || 0, precio: item.precio_distribuidor || 0, es_base: true }, ...loadedDistTiers];
             } else {
                  let foundDistBase = false;
                  loadedDistTiers = loadedDistTiers.map(t => {
                      if (!foundDistBase && Number(t.precio) === Number(item.precio_distribuidor)) {
                          foundDistBase = true;
                          return { ...t, es_base: true };
                      }
                      return { ...t, es_base: false };
                  });
             }
             if (loadedDistTiers.length > 0 && !loadedDistTiers.some(t => t.es_base)) loadedDistTiers[0].es_base = true;
        }

        setFormData({ 
            codigo: item.codigo || '', categoria: item.categoria || '', nombre: item.nombre, 
            descripcion: item.descripcion || '', observaciones: item.observaciones || '',
            venta_minima: item.venta_minima !== null && item.venta_minima !== undefined ? Math.floor(item.venta_minima) : 0, 
            precios_escalonados: loadedTiers,
            tienePrecioDistribuidor: hasDistribuidorConfig,
            precios_distribuidor: loadedDistTiers,
            es_por_metro: item.es_por_metro || false
        });
    } else {
        setEditingItem(null);
        setFormData({ 
            codigo: '', categoria: '', nombre: '', descripcion: '', observaciones: '', 
            venta_minima: '0', 
            precios_escalonados: [{ cantidad: '0', precio: '', es_base: true }],
            tienePrecioDistribuidor: false, 
            precios_distribuidor: [],
            es_por_metro: false 
        });
    }
    setIsModalOpen(true);
  };

  const addTier = () => { 
      setFormData(prev => ({ 
          ...prev, 
          precios_escalonados: [...prev.precios_escalonados, { cantidad: '', precio: '', es_base: prev.precios_escalonados.length === 0 }] 
      })); 
  };
  const updateTier = (index, field, value) => {
      const newTiers = [...formData.precios_escalonados];
      newTiers[index][field] = value; 
      setFormData({ ...formData, precios_escalonados: newTiers });
  };
  const removeTier = (index) => { 
      setFormData({ ...formData, precios_escalonados: formData.precios_escalonados.filter((_, i) => i !== index) }); 
  };
  const setBasePublico = (index) => {
      setFormData(prev => ({
          ...prev,
          precios_escalonados: prev.precios_escalonados.map((t, i) => ({ ...t, es_base: i === index }))
      }));
  };

  const addDistTier = () => { 
      setFormData(prev => ({ 
          ...prev, 
          precios_distribuidor: [...prev.precios_distribuidor, { cantidad: '', precio: '', es_base: prev.precios_distribuidor.length === 0 }] 
      })); 
  };
  const updateDistTier = (index, field, value) => {
      const newTiers = [...formData.precios_distribuidor];
      newTiers[index][field] = value;
      setFormData({ ...formData, precios_distribuidor: newTiers });
  };
  const removeDistTier = (index) => { 
      setFormData({ ...formData, precios_distribuidor: formData.precios_distribuidor.filter((_, i) => i !== index) }); 
  };
  const setBaseDist = (index) => {
      setFormData(prev => ({
          ...prev,
          precios_distribuidor: prev.precios_distribuidor.map((t, i) => ({ ...t, es_base: i === index }))
      }));
  };

  const handleSave = async () => {
      if (!formData.nombre) return toast({ title: "Atención", description: "El nombre es obligatorio", variant: "destructive" });
      
      const cleanedTiers = formData.precios_escalonados
          .map(t => ({ cantidad: parseInt(t.cantidad, 10), precio: Number(t.precio), es_base: t.es_base }))
          .filter(t => !isNaN(t.cantidad) && t.cantidad >= 0 && !isNaN(t.precio) && t.precio > 0);
          
      const cleanedDistTiers = formData.precios_distribuidor
          .map(t => ({ cantidad: parseInt(t.cantidad, 10), precio: Number(t.precio), es_base: t.es_base }))
          .filter(t => !isNaN(t.cantidad) && t.cantidad >= 0 && !isNaN(t.precio) && t.precio > 0);
          
      if (cleanedTiers.length === 0) {
          return toast({ title: "Atención", description: "Debe añadir al menos un precio público válido.", variant: "destructive" });
      }

      const baseTier = cleanedTiers.find(t => t.es_base) || cleanedTiers[0];
      const baseDistTier = cleanedDistTiers.find(t => t.es_base) || cleanedDistTiers[0];

      setSaving(true);
      try {
          const finalData = { 
              codigo: formData.codigo, categoria: formData.categoria, nombre: formData.nombre, 
              descripcion: formData.descripcion, observaciones: formData.observaciones,
              precio: baseTier.precio, // Restaurado: todos los productos tienen precio base
              venta_minima: formData.venta_minima !== '' ? parseInt(formData.venta_minima, 10) : 0, 
              precios_escalonados: cleanedTiers.map(t => ({cantidad: t.cantidad, precio: t.precio})),
              precio_distribuidor: (formData.tienePrecioDistribuidor && baseDistTier) ? baseDistTier.precio : 0,
              precios_distribuidor: formData.tienePrecioDistribuidor ? cleanedDistTiers.map(t => ({cantidad: t.cantidad, precio: t.precio})) : [],
              es_por_metro: formData.es_por_metro 
          };

          if (editingItem) {
              const { error } = await supabase.from('catalogo_productos').update(finalData).eq('id', editingItem.id);
              if (error) throw error;
              toast({ title: "Actualizado", description: "Producto modificado exitosamente." });
          } else {
              const { error } = await supabase.from('catalogo_productos').insert([finalData]);
              if (error) throw error;
              toast({ title: "Creado", description: "Nuevo producto añadido." });
          }
          setIsModalOpen(false);
          fetchCatalog(activeSearchTerm);
      } catch (error) {
          toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
      } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
      if (isReadOnly || !confirm("¿Seguro que deseas eliminar este producto?")) return;
      try {
          await supabase.from('catalogo_productos').delete().eq('id', id);
          toast({ title: "Eliminado", description: "Producto borrado." });
          fetchCatalog(activeSearchTerm);
      } catch (error) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleExportCSV = () => {
      let csvContent = "\uFEFF"; 
      
      const grouped = items.reduce((acc, item) => {
          const cat = item.categoria || 'General';
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(item);
          return acc;
      }, {});

      let maxTiers = 1;
      let maxDistTiers = 1;
      items.forEach(item => {
          if (item.precios_escalonados && item.precios_escalonados.length > maxTiers) maxTiers = item.precios_escalonados.length;
          if (item.precios_distribuidor && item.precios_distribuidor.length > maxDistTiers) maxDistTiers = item.precios_distribuidor.length;
      });

      for (const [cat, catItems] of Object.entries(grouped)) {
          csvContent += `"CATEGORÍA: ${cat}"\n`;
          
          let headers = ['ID', 'CÓDIGO PRODUCTO', 'NOMBRE DE PRODUCTO', 'DESCRIPCIÓN', 'OBSERVACIONES', 'POR METRO'];
          for (let i = 0; i < maxTiers; i++) {
              headers.push('CANT');
              headers.push('PRECIO PÚBLICO');
          }
          for (let i = 0; i < maxDistTiers; i++) {
              headers.push('CANT DIST');
              headers.push('PRECIO MAYORISTA');
          }
          csvContent += headers.map(h => `"${h}"`).join(';') + '\n';

          catItems.forEach(item => {
              let row = [
                  item.id || '',
                  item.codigo || '',
                  item.nombre || '',
                  item.descripcion || '',
                  item.observaciones || '',
                  item.es_por_metro ? 'SI' : 'NO'
              ];
              
              const tiers = item.precios_escalonados || [];
              for (let i = 0; i < maxTiers; i++) {
                  if (i < tiers.length) {
                      row.push(tiers[i].cantidad !== undefined ? tiers[i].cantidad : '');
                      row.push(tiers[i].precio !== undefined ? tiers[i].precio : '');
                  } else {
                      row.push(''); row.push('');
                  }
              }

              const distTiers = item.precios_distribuidor || [];
              for (let i = 0; i < maxDistTiers; i++) {
                  if (i < distTiers.length) {
                      row.push(distTiers[i].cantidad !== undefined ? distTiers[i].cantidad : '');
                      row.push(distTiers[i].precio !== undefined ? distTiers[i].precio : '');
                  } else {
                      row.push(''); row.push('');
                  }
              }
              
              csvContent += row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';') + '\n';
          });
          csvContent += '\n';
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Plantilla_Catalogo_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleCSVUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploadingCSV(true);
      
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const text = event.target.result;
              const firstLine = text.split('\n')[0] || '';
              const delimiter = firstLine.includes(';') ? ';' : ',';
              const lines = []; let currentRow = []; let currentVal = ''; let inQuotes = false;
              
              for (let i = 0; i < text.length; i++) {
                  const char = text[i]; const nextChar = text[i+1];
                  if (char === '"') { if (inQuotes && nextChar === '"') { currentVal += '"'; i++; } else { inQuotes = !inQuotes; } } 
                  else if (char === delimiter && !inQuotes) { currentRow.push(currentVal.trim()); currentVal = ''; } 
                  else if ((char === '\n' || char === '\r') && !inQuotes) { if (char === '\r' && nextChar === '\n') i++; currentRow.push(currentVal.trim()); lines.push(currentRow); currentRow = []; currentVal = ''; } 
                  else { currentVal += char; }
              }
              if (currentRow.length > 0 || currentVal !== '') { currentRow.push(currentVal.trim()); lines.push(currentRow); }

              let currentCategory = 'General';
              let idxId = -1, idxNombre = -1, idxCodigo = -1, idxDesc = -1, idxObs = -1, idxMetro = -1;
              let cantIndexes = []; let cantDistIndexes = [];
              const productsToInsert = [];

              for (let i = 0; i < lines.length; i++) {
                  const row = lines[i];
                  if (!row || row.length === 0 || (row.length === 1 && row[0] === '')) continue;
                  
                  const possibleCategory = row.find(cell => cell && (cell.toUpperCase().includes('CATEGORÍA:') || cell.toUpperCase().includes('CATEGORIA:')));
                  if (possibleCategory) { currentCategory = possibleCategory.replace(/CATEGORÍA:/gi, '').replace(/CATEGORIA:/gi, '').replace(/"/g, '').trim(); continue; }

                  if (row.some(cell => cell && cell.toUpperCase().includes('NOMBRE DE PRODUCTO'))) {
                      idxId = row.findIndex(c => c && c.toUpperCase() === 'ID');
                      idxNombre = row.findIndex(c => c && c.toUpperCase().includes('NOMBRE DE PRODUCTO'));
                      idxCodigo = row.findIndex(c => c && c.toUpperCase().includes('PRODUCTO') && !c.toUpperCase().includes('NOMBRE'));
                      idxDesc = row.findIndex(c => c && c.toUpperCase().includes('DESCRIPCI'));
                      idxObs = row.findIndex(c => c && c.toUpperCase().includes('OBSERVACIONES'));
                      idxMetro = row.findIndex(c => c && c.toUpperCase().includes('METRO'));
                      cantIndexes = []; cantDistIndexes = [];
                      row.forEach((col, index) => { 
                          if (col) {
                              const colName = col.toUpperCase().trim();
                              if (colName === 'CANT' || colName === 'CANT.') cantIndexes.push(index);
                              else if (colName === 'CANT DIST' || colName === 'CANT DIST.' || colName.includes('CANT MAYORISTA')) cantDistIndexes.push(index);
                          }
                      });
                      continue;
                  }

                  if (idxNombre !== -1 && row[idxNombre]) {
                      const nombre = row[idxNombre];
                      if (!nombre || nombre.trim() === '' || nombre.toUpperCase().includes('NOMBRE DE PRODUCTO')) continue;
                      
                      const esMetro = idxMetro !== -1 && row[idxMetro] && row[idxMetro].toUpperCase().includes('SI');

                      let precios_escalonados = [];
                      cantIndexes.forEach(cantIdx => {
                          let cantStr = row[cantIdx] ? String(row[cantIdx]).trim() : '';
                          let cantVal = parseInt(cantStr.replace(/,/g, '').replace(/[^0-9]/g, ''), 10);
                          if (isNaN(cantVal) || cantVal < 0) cantVal = 0; 
                          
                          const rawPrecio = row[cantIdx + 1] ? String(row[cantIdx + 1]) : '';
                          const precioLimpio = rawPrecio.replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '.').trim();
                          const precioVal = Number(precioLimpio);

                          if (precioVal >= 0 && !precios_escalonados.some(p => p.cantidad === cantVal)) {
                              precios_escalonados.push({ cantidad: cantVal, precio: precioVal, es_base: false });
                          }
                      });
                      precios_escalonados.sort((a,b) => a.cantidad - b.cantidad);
                      if (precios_escalonados.length > 0) precios_escalonados[0].es_base = true;
                      
                      const basePrecio = precios_escalonados.length > 0 ? precios_escalonados[0].precio : 0;
                      const baseMinima = precios_escalonados.length > 0 ? precios_escalonados[0].cantidad : 0;

                      let precios_distribuidor = [];
                      cantDistIndexes.forEach(cantIdx => {
                          let cantStr = row[cantIdx] ? String(row[cantIdx]).trim() : '';
                          let cantVal = parseInt(cantStr.replace(/,/g, '').replace(/[^0-9]/g, ''), 10);
                          if (isNaN(cantVal) || cantVal < 0) cantVal = 0; 
                          
                          const rawPrecio = row[cantIdx + 1] ? String(row[cantIdx + 1]) : '';
                          const precioLimpio = rawPrecio.replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '.').trim();
                          const precioVal = Number(precioLimpio);

                          if (precioVal >= 0 && !precios_distribuidor.some(p => p.cantidad === cantVal)) {
                              precios_distribuidor.push({ cantidad: cantVal, precio: precioVal, es_base: false });
                          }
                      });
                      precios_distribuidor.sort((a,b) => a.cantidad - b.cantidad);
                      if (precios_distribuidor.length > 0) precios_distribuidor[0].es_base = true;
                      
                      const basePrecioDist = precios_distribuidor.length > 0 ? precios_distribuidor[0].precio : 0;

                      let productData = {
                          codigo: idxCodigo !== -1 ? row[idxCodigo] : null,
                          categoria: currentCategory,
                          nombre,
                          descripcion: idxDesc !== -1 ? row[idxDesc] : null,
                          observaciones: idxObs !== -1 ? row[idxObs] : null,
                          precio: basePrecio,
                          venta_minima: baseMinima,
                          precios_escalonados: precios_escalonados.map(t => ({cantidad: t.cantidad, precio: t.precio})),
                          precio_distribuidor: basePrecioDist,
                          precios_distribuidor: precios_distribuidor.map(t => ({cantidad: t.cantidad, precio: t.precio})),
                          es_por_metro: esMetro
                      };

                      if (idxId !== -1 && row[idxId] && row[idxId].trim() !== '') {
                          productData.id = row[idxId].trim();
                      }

                      productsToInsert.push(productData);
                  }
              }

              if (productsToInsert.length > 0) {
                  const chunkSize = 50;
                  for (let i = 0; i < productsToInsert.length; i += chunkSize) {
                      const chunk = productsToInsert.slice(i, i + chunkSize);
                      const { error } = await supabase.from('catalogo_productos').upsert(chunk, { onConflict: 'id' });
                      if (error) throw error;
                  }
                  toast({ title: "✅ Sincronización Exitosa", description: `Se guardaron o actualizaron ${productsToInsert.length} productos sin errores.` });
                  fetchCatalog(activeSearchTerm);
              } else {
                  toast({ title: "Atención", description: "No se encontraron productos para importar. Verifica el formato.", variant: "destructive" });
              }
          } catch (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); } 
          finally { setUploadingCSV(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
      };
      reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><BookOpen className="h-6 w-6 text-purple-600" /> Catálogo de Precios</h2>
                <p className="text-slate-500">Consulta y administra productos con precios únicos, por volumen y tarifas de distribuidor.</p>
            </div>
            {!isReadOnly && (
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Button variant="outline" onClick={handleExportCSV} className="border-green-200 text-green-700 hover:bg-green-50 shadow-sm">
                        <Download className="h-4 w-4 mr-2" /> Descargar CSV
                    </Button>
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleCSVUpload} />
                    <Button variant="outline" onClick={() => fileInputRef.current.click()} disabled={uploadingCSV} className="border-purple-200 text-purple-700 hover:bg-purple-50 shadow-sm">
                        {uploadingCSV ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Upload className="h-4 w-4 mr-2" />} Cargar CSV Múltiple
                    </Button>
                    <Button onClick={() => handleOpenModal()} className="bg-purple-600 hover:bg-purple-700 text-white gap-2 px-6 shadow-sm">
                        <Plus className="h-4 w-4" /> Nuevo Producto
                    </Button>
                </div>
            )}
        </div>

        <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-4">
                    <div className="relative w-full max-w-md flex items-center gap-2">
                        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input placeholder="Buscar código, nombre..." className="pl-9 bg-white" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleSearchKeyDown}/></div>
                        <Button variant="secondary" onClick={() => setActiveSearchTerm(searchInput)}>Buscar</Button>
                    </div>
                    <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={() => fetchCatalog(activeSearchTerm)} disabled={loading}><RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`}/></Button></div>
                </div>

                {uniqueCategories.length > 0 && (
                    <div className="px-4 pb-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-bold text-slate-500 flex items-center mr-1"><Filter className="h-3 w-3 mr-1"/> Filtros:</span>
                        {uniqueCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => toggleCategory(cat)}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all duration-200 ${
                                    selectedCategories.includes(cat)
                                        ? 'bg-purple-600 text-white border border-purple-700 shadow-sm'
                                        : 'bg-white text-slate-600 border border-slate-300 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                        {selectedCategories.length > 0 && (
                            <button
                                onClick={() => setSelectedCategories([])}
                                className="px-3 py-1 rounded-full text-[10px] font-bold uppercase text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors ml-auto border border-transparent hover:border-red-200"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-800 text-white">
                            <tr>
                                <SortableHeader label="Código" sortKey="codigo" width="w-24" />
                                <SortableHeader label="Categoría / Producto" sortKey="nombre" />
                                <SortableHeader label="V. Mínima" sortKey="venta_minima" align="center" width="w-28" />
                                <SortableHeader label="Precios Público" sortKey="precio" align="right" width="w-48" />
                                <SortableHeader label="Precios Distribuidor" sortKey="precio_distribuidor" align="right" width="w-48" />
                                {!isReadOnly && <th className="px-4 py-3 font-semibold text-center w-24">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {loading ? <tr><td colSpan="6" className="text-center py-10 text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2"/> Cargando...</td></tr>
                            : processedItems.length === 0 ? <tr><td colSpan="6" className="text-center py-10 text-slate-500">No se encontraron productos con estos filtros.</td></tr>
                            : processedItems.map(item => (
                                    <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500 align-top">{item.codigo || '-'}</td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="text-[10px] font-bold text-purple-600 mb-0.5 uppercase tracking-wider">{item.categoria}</div>
                                            <div className="font-bold text-slate-800 uppercase">{item.nombre}</div>
                                            {item.es_por_metro && <span className="text-[9px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded mt-1 inline-block uppercase">SE COBRA POR METRO</span>}
                                            <div className="mt-1 space-y-1">
                                               {item.descripcion && <div className="text-xs text-slate-700 line-clamp-2" title={item.descripcion}><span className="font-semibold text-slate-500">Desc:</span> {item.descripcion}</div>}
                                               {item.observaciones && <div className="text-[10px] text-slate-500 line-clamp-2" title={item.observaciones}><span className="font-semibold text-slate-400">Obs:</span> {item.observaciones}</div>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-top text-center">
                                            <span className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">{item.venta_minima !== null && item.venta_minima !== undefined ? Math.floor(item.venta_minima) : 0}</span>
                                        </td>
                                        
                                        <td className="px-4 py-3 text-right align-top bg-slate-50/50">
                                            <div className="font-bold text-green-700 mb-1 border-b border-slate-200 pb-1">Base: ${Number(item.precio).toFixed(2)}</div>
                                            {item.precios_escalonados && item.precios_escalonados.length > 0 && (
                                                <div className="space-y-1 text-[10px] rounded mt-1">
                                                    {item.precios_escalonados.sort((a,b) => a.cantidad - b.cantidad).map((tier, idx) => (
                                                        <div key={idx} className="flex justify-between items-center text-slate-600 border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                                                            <span className="font-medium">≥ {tier.cantidad}</span>
                                                            <span className="font-bold text-slate-800">${Number(tier.precio).toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        
                                        <td className="px-4 py-3 text-right align-top bg-blue-50/30 border-l border-slate-100">
                                            {Number(item.precio_distribuidor) > 0 || (item.precios_distribuidor && item.precios_distribuidor.length > 0) ? (
                                                <>
                                                    <div className="font-bold text-blue-700 mb-1 border-b border-blue-100 pb-1">Base: ${Number(item.precio_distribuidor).toFixed(2)}</div>
                                                    {item.precios_distribuidor && item.precios_distribuidor.length > 0 && (
                                                        <div className="space-y-1 text-[10px] rounded mt-1">
                                                            {item.precios_distribuidor.sort((a,b) => a.cantidad - b.cantidad).map((tier, idx) => (
                                                                <div key={idx} className="flex justify-between items-center text-blue-800 border-b border-blue-100 pb-1 last:border-0 last:pb-0">
                                                                    <span className="font-medium">≥ {tier.cantidad}</span>
                                                                    <span className="font-bold">${Number(tier.precio).toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">No aplica</span>
                                            )}
                                        </td>

                                        {!isReadOnly && (
                                            <td className="px-4 py-3 align-top">
                                                <div className="flex justify-center gap-2">
                                                    <Button variant="outline" size="icon" onClick={() => handleOpenModal(item)} className="h-7 w-7 text-blue-600"><Edit2 className="h-3 w-3" /></Button>
                                                    <Button variant="outline" size="icon" onClick={() => handleDelete(item.id)} className="h-7 w-7 text-red-600"><Trash2 className="h-3 w-3" /></Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>

        {isModalOpen && !isReadOnly && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-4xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[95vh] rounded-xl shadow-2xl">
                    <div className="bg-slate-800 p-4 text-white flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-lg flex items-center gap-2"><BookOpen className="h-5 w-5 text-purple-400" />{editingItem ? 'Editar Producto' : 'Crear Nuevo Producto'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="hover:bg-slate-700 p-1 rounded"><X className="h-5 w-5" /></button>
                    </div>
                    
                    <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <h4 className="font-bold text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">Información General</h4>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-3"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Código (Opcional)</label><Input value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})} placeholder="Ej: P001" className="bg-slate-50"/></div>
                                <div className="md:col-span-4"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Categoría</label><Input value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} placeholder="Ej: Letreros" className="bg-slate-50"/></div>
                                <div className="md:col-span-5"><label className="text-xs font-bold text-slate-800 uppercase mb-1 block">Nombre de Producto *</label><Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="font-semibold text-blue-900 border-blue-200" /></div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Descripción Técnica</label><textarea className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none h-20 resize-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} placeholder="Materiales, dimensiones, etc."/></div>
                                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Observaciones / Condiciones Especiales</label><textarea className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none h-20 resize-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500" value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} placeholder="Ej: No incluye instalación..." /></div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-4">
                                <h4 className="font-bold text-slate-700 flex items-center gap-2">Configuración de Precios</h4>
                                
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-md border border-red-100">
                                        <label className="text-xs font-bold text-red-700 flex items-center gap-1"><ShieldAlert className="h-3 w-3"/> Venta Mínima:</label>
                                        <Input 
                                           type="number" 
                                           step="1" 
                                           min="0" 
                                           value={formData.venta_minima} 
                                           onChange={e => setFormData({...formData, venta_minima: e.target.value})} 
                                           onKeyDown={e => {
                                               if (e.key === '.' || e.key === ',') e.preventDefault();
                                           }}
                                           className="border-red-300 font-bold text-center w-20 h-7 text-xs bg-white" 
                                        />
                                    </div>
                                    
                                    <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-md border border-purple-200">
                                        <label htmlFor="metro-switch" className="text-xs font-bold text-purple-800 cursor-pointer select-none">Se cobra por Metro</label>
                                        <Switch id="metro-switch" checked={formData.es_por_metro} onCheckedChange={(c) => setFormData({...formData, es_por_metro: c})} />
                                    </div>

                                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100">
                                        <label htmlFor="dist-switch" className="text-xs font-bold text-blue-800 cursor-pointer select-none">Tarifa Mayorista</label>
                                        <Switch id="dist-switch" checked={formData.tienePrecioDistribuidor} onCheckedChange={(c) => setFormData({...formData, tienePrecioDistribuidor: c})} />
                                    </div>
                                </div>
                            </div>

                            <div className={`grid grid-cols-1 ${formData.tienePrecioDistribuidor ? 'md:grid-cols-2' : ''} gap-6 items-start`}>
                                
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <DollarSign className="h-4 w-4 text-green-700"/>
                                        <span className="text-xs font-bold text-green-800 uppercase">Lista de Precios (Público) *</span>
                                    </div>
                                    
                                    <div className="space-y-2 mb-3">
                                        {formData.precios_escalonados.map((tier, index) => (
                                            <div key={index} className={`flex items-center gap-2 p-2 rounded shadow-sm border ${tier.es_base ? 'bg-green-50 border-green-400' : 'bg-white border-slate-200'}`}>
                                                <label className="flex flex-col items-center justify-center cursor-pointer mr-1 px-1" title="Marcar como Precio Base">
                                                    <input type="radio" name="base_publico" checked={tier.es_base || false} onChange={() => setBasePublico(index)} className="w-4 h-4 text-green-600 focus:ring-green-500 cursor-pointer" />
                                                    <span className={`text-[8px] font-bold mt-1 ${tier.es_base ? 'text-green-700' : 'text-slate-400'}`}>BASE</span>
                                                </label>

                                                <span className="text-[10px] text-slate-500 font-bold w-9">Cant:</span>
                                                <Input 
                                                   type="number" step="1" min="0" value={tier.cantidad} 
                                                   onChange={e => updateTier(index, 'cantidad', e.target.value)} 
                                                   onKeyDown={e => { if (e.key === '.' || e.key === ',') e.preventDefault(); }}
                                                   className="h-9 text-sm font-bold w-16 text-center bg-white border-slate-300"
                                                />
                                                <span className="text-[10px] text-slate-500 font-bold">unds</span>
                                                
                                                <span className="text-[10px] text-green-700 font-bold ml-auto mr-1">Precio: $</span>
                                                <Input type="number" step="0.01" min="0" value={tier.precio} onChange={e => updateTier(index, 'precio', e.target.value)} className="h-9 text-sm border-green-300 bg-white font-bold text-green-700 w-20 text-right"/>
                                                <Button variant="ghost" size="icon" onClick={() => removeTier(index)} className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 ml-1"><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                        ))}
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={addTier} className="w-full border-dashed border-slate-300 text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-800"><Plus className="h-4 w-4 mr-2" /> Añadir precio / escala</Button>
                                </div>

                                {formData.tienePrecioDistribuidor && (
                                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-200 animate-in fade-in slide-in-from-right-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <DollarSign className="h-4 w-4 text-blue-700"/>
                                            <span className="text-xs font-bold text-blue-800 uppercase">Lista de Precios (Mayorista)</span>
                                        </div>
                                        
                                        <div className="space-y-2 mb-3">
                                            {formData.precios_distribuidor.map((tier, index) => (
                                                <div key={index} className={`flex items-center gap-2 p-2 rounded shadow-sm border ${tier.es_base ? 'bg-blue-50 border-blue-400' : 'bg-white border-slate-200'}`}>
                                                    <label className="flex flex-col items-center justify-center cursor-pointer mr-1 px-1" title="Marcar como Precio Base">
                                                        <input type="radio" name="base_dist" checked={tier.es_base || false} onChange={() => setBaseDist(index)} className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                                        <span className={`text-[8px] font-bold mt-1 ${tier.es_base ? 'text-blue-700' : 'text-slate-400'}`}>BASE</span>
                                                    </label>

                                                    <span className="text-[10px] text-slate-500 font-bold w-9">Cant:</span>
                                                    <Input 
                                                       type="number" step="1" min="0" value={tier.cantidad} 
                                                       onChange={e => updateDistTier(index, 'cantidad', e.target.value)} 
                                                       onKeyDown={e => { if (e.key === '.' || e.key === ',') e.preventDefault(); }}
                                                       className="h-9 text-sm font-bold w-16 text-center bg-white border-slate-300"
                                                    />
                                                    <span className="text-[10px] text-slate-500 font-bold">unds</span>
                                                    
                                                    <span className="text-[10px] text-blue-700 font-bold ml-auto mr-1">Precio: $</span>
                                                    <Input type="number" step="0.01" min="0" value={tier.precio} onChange={e => updateDistTier(index, 'precio', e.target.value)} className="h-9 text-sm border-blue-300 bg-white font-bold text-blue-800 w-20 text-right"/>
                                                    <Button variant="ghost" size="icon" onClick={() => removeDistTier(index)} className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 ml-1"><Trash2 className="h-4 w-4"/></Button>
                                                </div>
                                            ))}
                                        </div>
                                        <Button type="button" variant="outline" size="sm" onClick={addDistTier} className="w-full border-dashed border-blue-300 text-blue-700 bg-white hover:bg-blue-100 hover:border-blue-400"><Plus className="h-4 w-4 mr-2" /> Añadir precio / escala</Button>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                    
                    <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)} className="bg-white">Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white min-w-[160px] shadow-md text-base">{saving ? <Loader2 className="h-5 w-5 animate-spin mr-2"/> : <Save className="h-5 w-5 mr-2"/>} {editingItem ? 'Actualizar' : 'Guardar Producto'}</Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CatalogPanel;