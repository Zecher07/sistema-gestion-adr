import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Package, Search, Plus, Save, Edit2, Trash2, Loader2, RefreshCw, X, Filter, ChevronLeft, ChevronRight, Warehouse, ArrowUpDown, Settings, Check, Printer, History, CalendarIcon, DollarSign, ShoppingCart, Scale, ClipboardList, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text'; 
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const InventoryPanel = ({ user, mode = 'manage' }) => {
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('inventory'); 
  const [printType, setPrintType] = useState('normal');

  const [items, setItems] = useState([]);
  const [bodegasList, setBodegasList] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBodega, setSelectedBodega] = useState(''); 
  
  const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'asc' });

  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  
  const canEditInventory = user?.role === 'Administrador' || user?.role === 'Producción';
  const isReadOnly = !canEditInventory || mode === 'view';
  const isAdmin = user?.role === 'Administrador';
  const isProduccion = user?.role === 'Producción'; 

  // Modal Crear/Editar Material
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Modal Bodegas
  const [isBodegasModalOpen, setIsBodegasModalOpen] = useState(false);
  const [newBodegaName, setNewBodegaName] = useState('');
  const [editingBodegaId, setEditingBodegaId] = useState(null);
  const [editBodegaName, setEditBodegaName] = useState('');
  const [bodegaLoading, setBodegaLoading] = useState(false);
  
  const [formData, setFormData] = useState({ 
      codigo: '', nombre: '', categoria: '', cantidad: 0, unidad: 'Unidades', ubicacion: '', bodega: 'PRINCIPAL',
      valor_perdida: 0, valor_compra: 0, proveedores: ''
  });
  const [saving, setSaving] = useState(false);

  // Historial Item
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [itemHistoryData, setItemHistoryData] = useState([]);
  const [itemHistoryLoading, setItemHistoryLoading] = useState(false);

  // Historial Global
  const [globalHistory, setGlobalHistory] = useState([]);
  const [globalHistoryLoading, setGlobalHistoryLoading] = useState(false);

  // Modal COMPRAS
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseRef, setPurchaseRef] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([{ inventoryId: '', qty: '', searchTerm: '', isSearching: false }]);

  // Modal CONSUMO INTERNO
  const [isConsumeModalOpen, setIsConsumeModalOpen] = useState(false);
  const [consumeReason, setConsumeReason] = useState('');
  const [consumeItems, setConsumeItems] = useState([{ inventoryId: '', qty: '', searchTerm: '', isSearching: false }]);

  // Modal CUADRE DE INVENTARIO
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustItems, setAdjustItems] = useState([{ inventoryId: '', newQty: '', reason: '', searchTerm: '', isSearching: false }]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: invData, error: invError } = await supabase.from('inventario').select('*').order('nombre');
      if (invError) throw invError;
      setItems(invData || []);

      const { data: bodData, error: bodError } = await supabase.from('bodegas').select('*').order('nombre');
      if (bodError) throw bodError;
      // 🔧 FIX: un arreglo vacío [] es "verdadero" en JS, así que "bodData || fallback"
      // nunca usaba el respaldo si la tabla 'bodegas' existía pero estaba vacía —
      // dejando el selector de bodega sin ninguna opción para elegir.
      setBodegasList(bodData && bodData.length > 0 ? bodData : [{ id: 1, nombre: 'PRINCIPAL' }]);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error", description: "No se pudieron cargar los datos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalHistory = async () => {
      setGlobalHistoryLoading(true);
      try {
          const { data, error } = await supabase
              .from('historial_inventario')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1000); 
          if (error) throw error;
          setGlobalHistory(data || []);
      } catch (err) {
          console.error("Error fetching global history:", err);
          toast({title: "Error", description: "No se pudo cargar el historial general.", variant: "destructive"});
      } finally {
          setGlobalHistoryLoading(false);
      }
  };

  useEffect(() => {
      if (activeTab === 'history') fetchGlobalHistory();
  }, [activeTab]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, itemsPerPage, selectedCategory, selectedBodega]);

  const categories = [...new Set(items.map(i => i.categoria).filter(Boolean))].sort();

  const groupedGlobalHistory = useMemo(() => {
      const groups = {};
      globalHistory.forEach(reg => {
          const dateObj = new Date(reg.created_at);
          const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          const CapitalizedDateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
          
          if (!groups[CapitalizedDateStr]) groups[CapitalizedDateStr] = [];
          groups[CapitalizedDateStr].push(reg);
      });
      return groups;
  }, [globalHistory]);

  const openItemHistory = async (item) => {
      setEditingItem(item);
      setIsHistoryModalOpen(true);
      setItemHistoryLoading(true);
      try {
          const { data, error } = await supabase.from('historial_inventario').select('*').eq('material_id', Number(item.id)).order('created_at', { ascending: false }).limit(100);
          if (error) throw error;
          setItemHistoryData(data || []);
      } catch (err) {
          console.error("Error fetching item history:", err);
          toast({title: "Sin registros", description: "Aún no hay historial o hubo un error de conexión.", variant: "warning"});
      } finally {
          setItemHistoryLoading(false);
      }
  };

  const handleAddBodega = async () => {
      if (!newBodegaName.trim()) return;
      const name = newBodegaName.trim().toUpperCase();
      if (bodegasList.find(b => b.nombre === name)) return toast({ title: "Error", description: "La bodega ya existe.", variant: "destructive" });
      setBodegaLoading(true);
      try {
          const { error } = await supabase.from('bodegas').insert([{ nombre: name }]);
          if (error) throw error;
          toast({ title: "Bodega Creada" });
          setNewBodegaName('');
          fetchData();
      } catch (error) { toast({ title: "Error al crear", description: error.message, variant: "destructive" }); } 
      finally { setBodegaLoading(false); }
  };

  const handleSaveEditBodega = async (bod) => {
      if (!editBodegaName.trim()) return;
      const newName = editBodegaName.trim().toUpperCase();
      if (bod.nombre === newName) return setEditingBodegaId(null);
      setBodegaLoading(true);
      try {
          const { error } = await supabase.from('bodegas').update({ nombre: newName }).eq('id', bod.id);
          if (error) throw error;
          await supabase.from('inventario').update({ bodega: newName }).eq('bodega', bod.nombre);
          toast({ title: "Bodega Actualizada" });
          setEditingBodegaId(null);
          if (selectedBodega === bod.nombre) setSelectedBodega(newName);
          fetchData();
      } catch (error) { toast({ title: "Error al actualizar", description: error.message, variant: "destructive" }); } 
      finally { setBodegaLoading(false); }
  };

  const handleDeleteBodega = async (bod) => {
      if (!confirm(`¿Seguro que deseas eliminar la bodega "${bod.nombre}"?`)) return;
      setBodegaLoading(true);
      try {
          const { count, error: countError } = await supabase.from('inventario').select('id', { count: 'exact' }).eq('bodega', bod.nombre);
          if (countError) throw countError;
          if (count > 0) {
              toast({ title: "No se puede borrar", description: `Esta bodega tiene ${count} productos. Muévelos a otra bodega editándolos primero.`, variant: "destructive" });
              setBodegaLoading(false);
              return;
          }
          const { error } = await supabase.from('bodegas').delete().eq('id', bod.id);
          if (error) throw error;
          toast({ title: "Bodega Eliminada" });
          if (selectedBodega === bod.nombre) setSelectedBodega('');
          fetchData();
      } catch (error) { toast({ title: "Error al eliminar", description: error.message, variant: "destructive" }); } 
      finally { setBodegaLoading(false); }
  };

  const handleOpenModal = (item = null) => {
    if (isReadOnly || !isAdmin) return; 
    if (item) {
        setEditingItem(item);
        setFormData({ 
            codigo: item.codigo || '', nombre: item.nombre || '', categoria: item.categoria || '',
            cantidad: item.cantidad !== undefined ? item.cantidad : 0, 
            unidad: item.unidad || 'Unidades', ubicacion: item.ubicacion || '',
            bodega: item.bodega || (bodegasList.length > 0 ? bodegasList[0].nombre : 'PRINCIPAL'),
            valor_perdida: item.valor_perdida || 0,
            valor_compra: item.valor_compra || 0,
            proveedores: item.proveedores || ''
        });
    } else {
        setEditingItem(null);
        setFormData({ 
            codigo: '', nombre: '', categoria: '', cantidad: 0, unidad: 'Unidades', ubicacion: '', 
            bodega: bodegasList.length > 0 ? bodegasList[0].nombre : 'PRINCIPAL',
            valor_perdida: 0, valor_compra: 0, proveedores: ''
        });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
      if (!formData.nombre) return toast({ title: "Atención", description: "El nombre es obligatorio", variant: "destructive" });
      const nuevaCantidad = formData.cantidad !== '' ? parseInt(formData.cantidad, 10) : 0;

      if (editingItem && isProduccion && nuevaCantidad < editingItem.cantidad) {
          return toast({ title: "Acción Restringida", description: "Producción no puede restar inventario manualmente.", variant: "destructive" });
      }

      setSaving(true);
      try {
          const payload = {
              ...formData,
              cantidad: nuevaCantidad,
              categoria: formData.categoria ? formData.categoria.trim().toUpperCase() : '',
              bodega: formData.bodega,
              valor_perdida: parseFloat(formData.valor_perdida) || 0,
              valor_compra: parseFloat(formData.valor_compra) || 0,
              proveedores: formData.proveedores
          };

          if (editingItem) {
              const { error } = await supabase.from('inventario').update(payload).eq('id', editingItem.id);
              if (error) throw error;
              
              const diff = nuevaCantidad - editingItem.cantidad;
              if (diff !== 0) {
                  await supabase.from('historial_inventario').insert([{
                      material_id: editingItem.id,
                      material_nombre: payload.nombre,
                      cantidad_cambio: diff,
                      cantidad_resultante: nuevaCantidad,
                      tipo: diff > 0 ? 'INGRESO' : 'EGRESO',
                      motivo: 'Ajuste Manual Administrativo',
                      usuario: user?.name || 'Sistema'
                  }]);
              }
              toast({ title: "Actualizado", description: "Inventario actualizado." });
          } else {
              const { data: newRow, error } = await supabase.from('inventario').insert([payload]).select().single();
              if (error) throw error;
              
              if (newRow && nuevaCantidad > 0) {
                  await supabase.from('historial_inventario').insert([{
                      material_id: newRow.id,
                      material_nombre: payload.nombre,
                      cantidad_cambio: nuevaCantidad,
                      cantidad_resultante: nuevaCantidad,
                      tipo: 'INGRESO',
                      motivo: 'Inventario Inicial',
                      usuario: user?.name || 'Sistema'
                  }]);
              }
              toast({ title: "Creado", description: "Material añadido al inventario." });
          }
          setIsModalOpen(false);
          fetchData();
      } catch (error) { 
          console.error("Save error:", error);
          toast({ title: "Error", description: error.message, variant: "destructive" }); 
      } 
      finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
      if (isReadOnly || !confirm("¿Seguro que deseas eliminar este material del inventario?")) return;
      try {
          const { error } = await supabase.from('inventario').delete().eq('id', id);
          if (error) throw error;
          toast({ title: "Eliminado", description: "Material borrado." });
          fetchData();
      } catch (error) { toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" }); }
  };

  const updateQuantity = async (id, currentQty, amount) => {
      if (!isAdmin) return; 
      const newQty = currentQty + amount;
      if (newQty < 0) return; 
      try {
          setItems(items.map(i => i.id === id ? { ...i, cantidad: newQty } : i));
          const { error } = await supabase.from('inventario').update({ cantidad: newQty }).eq('id', id);
          if (error) { fetchData(); throw error; }

          const item = items.find(i => i.id === id);
          await supabase.from('historial_inventario').insert([{
              material_id: id,
              material_nombre: item?.nombre || 'Desconocido',
              cantidad_cambio: amount,
              cantidad_resultante: newQty,
              tipo: amount > 0 ? 'INGRESO' : 'EGRESO',
              motivo: 'Ajuste manual rápido',
              usuario: user?.name || 'Sistema'
          }]);
      } catch (error) { toast({ title: "Error", description: "No se pudo actualizar la cantidad.", variant: "destructive" }); }
  };

  const openPurchaseModal = () => {
      setPurchaseRef('');
      setPurchaseItems([{ inventoryId: '', qty: '', searchTerm: '', isSearching: false }]);
      setIsPurchaseModalOpen(true);
  };

  const handleSavePurchase = async () => {
      const validItems = purchaseItems.filter(i => i.inventoryId && i.qty !== '' && Number(i.qty) > 0);
      if (validItems.length === 0) return toast({ title: "Atención", description: "Debe ingresar al menos un material con cantidad válida.", variant: "destructive" });

      setSaving(true);
      try {
          for (const pItem of validItems) {
              const target = items.find(i => String(i.id) === String(pItem.inventoryId));
              if (!target) continue;
              const newQty = target.cantidad + Number(pItem.qty);
              
              await supabase.from('inventario').update({ cantidad: newQty }).eq('id', target.id);
              await supabase.from('historial_inventario').insert([{
                  material_id: target.id,
                  material_nombre: target.nombre,
                  cantidad_cambio: Number(pItem.qty),
                  cantidad_resultante: newQty,
                  tipo: 'INGRESO',
                  motivo: `Ingreso por Compra ${purchaseRef ? '- Fac/Ref: ' + purchaseRef : ''}`,
                  usuario: user?.name || 'Sistema'
              }]);
          }
          toast({ title: "Compra Registrada", description: "Se ha sumado el stock correctamente." });
          setIsPurchaseModalOpen(false);
          fetchData();
      } catch (err) { 
          console.error("Purchase error:", err);
          toast({ title: "Error", description: "Hubo un problema al registrar la compra.", variant: "destructive" }); 
      } 
      finally { setSaving(false); }
  };

  const openConsumeModal = () => {
      setConsumeReason('');
      setConsumeItems([{ inventoryId: '', qty: '', searchTerm: '', isSearching: false }]);
      setIsConsumeModalOpen(true);
  };

  const handleSaveConsume = async () => {
      if (!consumeReason.trim()) return toast({ title: "Atención", description: "Debe especificar el motivo o destino del consumo.", variant: "destructive" });
      const validItems = consumeItems.filter(i => i.inventoryId && i.qty !== '' && Number(i.qty) > 0);
      if (validItems.length === 0) return toast({ title: "Atención", description: "Seleccione al menos un material a consumir.", variant: "destructive" });

      setSaving(true);
      try {
          for (const cItem of validItems) {
              const target = items.find(i => String(i.id) === String(cItem.inventoryId));
              if (!target) continue;
              
              const qtyToDeduct = Number(cItem.qty);
              if (qtyToDeduct > target.cantidad) {
                  throw new Error(`Stock insuficiente de ${target.nombre}. Solicitado: ${qtyToDeduct}, Disponible: ${target.cantidad}`);
              }

              const newQty = target.cantidad - qtyToDeduct;
              
              await supabase.from('inventario').update({ cantidad: newQty }).eq('id', target.id);
              await supabase.from('historial_inventario').insert([{
                  material_id: target.id,
                  material_nombre: target.nombre,
                  cantidad_cambio: -qtyToDeduct,
                  cantidad_resultante: newQty,
                  tipo: 'EGRESO',
                  motivo: `Consumo Interno / Operativo: ${consumeReason}`,
                  usuario: user?.name || 'Sistema'
              }]);
          }
          toast({ title: "Consumo Registrado", description: "Se ha descontado el stock operativo correctamente." });
          setIsConsumeModalOpen(false);
          fetchData();
      } catch (err) { 
          console.error("Consume error:", err);
          toast({ title: "Error de Stock", description: err.message, variant: "destructive" }); 
      } 
      finally { setSaving(false); }
  };

  const openAdjustModal = () => {
      setAdjustItems([{ inventoryId: '', newQty: '', reason: '', searchTerm: '', isSearching: false }]);
      setIsAdjustModalOpen(true);
  };

  const handleSaveAdjust = async () => {
      const validItems = adjustItems.filter(i => i.inventoryId && i.newQty !== '' && i.reason.trim() !== '');
      if (validItems.length === 0) return toast({ title: "Atención", description: "Debe completar material, stock real y justificación en las filas activas.", variant: "destructive" });

      setSaving(true);
      try {
          for (const aItem of validItems) {
              const target = items.find(i => String(i.id) === String(aItem.inventoryId));
              if (!target) continue;
              
              const nQty = parseInt(aItem.newQty, 10);
              const diff = nQty - target.cantidad;
              if (diff === 0) continue; 

              await supabase.from('inventario').update({ cantidad: nQty }).eq('id', target.id);
              await supabase.from('historial_inventario').insert([{
                  material_id: target.id,
                  material_nombre: target.nombre,
                  cantidad_cambio: diff,
                  cantidad_resultante: nQty,
                  tipo: diff > 0 ? 'INGRESO' : 'EGRESO',
                  motivo: `Cuadre de Inventario: ${aItem.reason}`,
                  usuario: user?.name || 'Sistema'
              }]);
          }
          toast({ title: "Cuadre Exitoso", description: "Se ha ajustado el inventario y guardado las justificaciones." });
          setIsAdjustModalOpen(false);
          fetchData();
      } catch (err) { 
          console.error("Adjust error:", err);
          toast({ title: "Error", description: "Hubo un problema al cuadrar el inventario.", variant: "destructive" }); 
      } 
      finally { setSaving(false); }
  };

  const calculateTotalLoss = () => {
      return adjustItems.reduce((sum, aItem) => {
          if (!aItem.inventoryId || aItem.newQty === '') return sum;
          const target = items.find(i => String(i.id) === String(aItem.inventoryId));
          if (!target) return sum;
          
          const nQty = parseInt(aItem.newQty, 10);
          const diff = nQty - target.cantidad;
          
          if (diff < 0) {
              const cost = target.valor_perdida || target.valor_compra || 0;
              return sum + (Math.abs(diff) * cost);
          }
          return sum; 
      }, 0);
  };

  const requestSort = (key) => {
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
  };

  const handlePrint = (type) => {
      setPrintType(type);
      setTimeout(() => {
          window.print();
      }, 100);
  };

  const processedItems = useMemo(() => {
      let filtered = items.filter(item => {
          const matchSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (item.codigo && item.codigo.toLowerCase().includes(searchTerm.toLowerCase()));
          const matchCategory = selectedCategory === '' || item.categoria === selectedCategory;
          const matchBodega = selectedBodega === '' || item.bodega === selectedBodega;
          return matchSearch && matchCategory && matchBodega;
      });

      // 🔧 CAMBIO DE DISEÑO: siempre alfabético (categoría, luego nombre) — ya no se
      // puede reordenar haciendo click en cada columna, para que la agrupación por
      // categoría (más abajo) siempre tenga sentido visual.
      filtered.sort((a, b) => {
          const catA = (a.categoria || '').toLowerCase();
          const catB = (b.categoria || '').toLowerCase();
          if (catA !== catB) return catA.localeCompare(catB);
          return (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase());
      });
      return filtered;
  }, [items, searchTerm, selectedCategory, selectedBodega]);

  const totalItems = processedItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedItems = processedItems.slice(startIndex, endIndex);

  // 🔧 CAMBIO DE DISEÑO: ya no es "clickeable" por columna (se quitó el ícono de
  // ordenar tipo tabla dinámica) — el orden ahora es siempre alfabético fijo.
  const SortableHeader = ({ label, align = 'left', width }) => (
      <th className={`px-2 py-2 whitespace-nowrap select-none ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'} ${width ? width : ''}`}>
          {label}
      </th>
  );

  return (
    <>
      <div className="space-y-4 animate-in fade-in print:hidden">
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between items-center gap-4">
              <div>
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                      <Package className="h-6 w-6 text-orange-600" /> {isReadOnly ? 'Inventario Disponible' : 'Gestión de Inventario'}
                  </h2>
                  <p className="text-slate-500">{isReadOnly ? 'Consulta el material disponible' : 'Controla y actualiza los materiales disponibles por bodega'}</p>
              </div>
              
              <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                  <Button onClick={() => handlePrint('normal')} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50 gap-2 font-bold shadow-sm">
                      <Printer className="h-4 w-4" /> Reporte Normal
                  </Button>
                  <Button onClick={() => handlePrint('audit')} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50 gap-2 font-bold shadow-sm">
                      <ClipboardList className="h-4 w-4" /> Imprimir Auditoría
                  </Button>
                  
                  {!isReadOnly && (
                      <>
                          {isAdmin && (
                              <Button onClick={() => setIsBodegasModalOpen(true)} variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50 gap-2 font-bold shadow-sm">
                                  <Settings className="h-4 w-4" /> Bodegas
                              </Button>
                          )}
                          <Button onClick={openPurchaseModal} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold shadow-sm">
                              <ShoppingCart className="h-4 w-4" /> Agregar Compra
                          </Button>
                          
                          {/* 🔧 FIX: "Registrar Consumo" ahora solo para Admin — Producción
                              estaba autoajustando el inventario y se perdía el control real. */}
                          {isAdmin && (
                              <Button onClick={openConsumeModal} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold shadow-sm">
                                  <PenTool className="h-4 w-4" /> Registrar Consumo
                              </Button>
                          )}

                          <Button onClick={openAdjustModal} className="bg-amber-500 hover:bg-amber-600 text-white gap-2 font-bold shadow-sm">
                              <Scale className="h-4 w-4" /> Cuadre
                          </Button>
                          {isAdmin && (
                              <Button onClick={() => handleOpenModal()} className="bg-orange-600 hover:bg-orange-700 text-white gap-2 font-bold shadow-sm">
                                  <Plus className="h-4 w-4" /> Añadir Material
                              </Button>
                          )}
                      </>
                  )}
              </div>
          </div>

          <div className="flex gap-2 bg-slate-200 p-1.5 rounded-lg w-fit border border-slate-300 shadow-inner">
             <button 
                onClick={() => setActiveTab('inventory')} 
                className={cn("px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all", activeTab === 'inventory' ? 'bg-white text-orange-600 shadow-sm border border-slate-300' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50')}
             >
                <Package className="h-4 w-4"/> INVENTARIO ACTUAL
             </button>
             <button 
                onClick={() => setActiveTab('history')} 
                className={cn("px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all", activeTab === 'history' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50')}
             >
                <History className="h-4 w-4"/> HISTORIAL Y CONSUMOS
             </button>
          </div>

          {activeTab === 'inventory' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col animate-in fade-in duration-300">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
                      <Warehouse className="h-3.5 w-3.5 text-slate-500 mr-0.5 shrink-0" />
                      <span className="text-[10px] font-bold text-slate-600 mr-1 uppercase tracking-wider shrink-0">Bodega:</span>
                      <button onClick={() => setSelectedBodega('')} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all whitespace-nowrap ${selectedBodega === '' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-300 hover:bg-orange-50 hover:text-orange-600'}`}>Todas</button>
                      {bodegasList.map(bod => (
                          <button key={bod.id} onClick={() => setSelectedBodega(bod.nombre)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all whitespace-nowrap ${selectedBodega === bod.nombre ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-300 hover:bg-orange-50 hover:text-orange-600'}`}>{bod.nombre}</button>
                      ))}
                  </div>

                  <div className="px-3 py-2 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-2">
                      <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                          <span>Mostrar</span>
                          <select className="border border-slate-300 rounded px-2 py-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
                              <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option>
                          </select>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                          <div className="flex items-center gap-1.5 w-full sm:w-auto">
                              <Filter className="h-3.5 w-3.5 text-slate-400" />
                              <select className="border border-slate-300 rounded px-2 py-0.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-700 w-full sm:w-40" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                                  <option value="">Todas las Categorías</option>{categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                              </select>
                          </div>
                          <div className="flex items-center gap-1.5 w-full sm:w-auto">
                              <div className="relative w-full">
                                  <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-slate-400"/>
                                  <input type="text" className="border border-slate-300 rounded-full pl-8 pr-7 py-1 text-xs w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Nombre o código..." />
                                  {searchTerm && (<X className="absolute right-2.5 top-1.5 h-3.5 w-3.5 text-slate-400 hover:text-slate-600 cursor-pointer" onClick={() => setSearchTerm('')} />)}
                              </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading} className="hidden sm:flex h-7 w-7 border border-slate-200 bg-white hover:bg-slate-100"><RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`}/></Button>
                      </div>
                  </div>

                  <div className="overflow-x-auto flex-1">
                      <table className="w-full text-sm text-left">
                          <thead className="text-xs text-slate-700 font-bold border-b border-slate-200 bg-slate-50/50 select-none">
                              <tr>
                                  <SortableHeader label="Material / Código" width="w-auto" />
                                  <th className="px-2 py-2 whitespace-nowrap text-center w-16">Hist.</th>
                                  <SortableHeader label="Cantidad" align="center" width="w-24" />
                                  <SortableHeader label="Valor Pérdida" align="right" width="w-24" />
                                  {isAdmin && <SortableHeader label="Costo Real" align="right" width="w-24" />}
                                  {isAdmin && <SortableHeader label="Proveedores" width="w-[160px]" />}
                                  {isAdmin && !isReadOnly && <th className="px-2 py-2 whitespace-nowrap text-center w-16">Acc.</th>}
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {loading ? (
                                  <tr><td colSpan={isAdmin ? "7" : "5"} className="text-center py-20 text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2"/> Cargando inventario...</td></tr>
                              ) : paginatedItems.length === 0 ? (
                                  <tr><td colSpan={isAdmin ? "7" : "5"} className="px-6 py-12 text-center text-slate-500 italic bg-slate-50/50"><div className="flex flex-col items-center gap-2"><Package className="h-8 w-8 text-slate-300" /><span className="text-lg font-medium text-slate-400">Sin resultados</span></div></td></tr>
                              ) : (
                                  paginatedItems.map((item, idx) => {
                                      // 🔧 CAMBIO DE DISEÑO: la categoría ya no se repite en cada fila — solo
                                      // aparece una vez, como encabezado de grupo, cuando cambia respecto a
                                      // la fila anterior (los items ya vienen ordenados por categoría).
                                      const prevItem = paginatedItems[idx - 1];
                                      const showCategoryHeader = !prevItem || (prevItem.categoria || '') !== (item.categoria || '');
                                      return (
                                      <React.Fragment key={item.id}>
                                          {showCategoryHeader && (
                                              <tr className="bg-slate-100">
                                                  <td colSpan={isAdmin ? 7 : 5} className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 border-y border-slate-200">
                                                      {item.categoria || 'SIN CATEGORÍA'}
                                                  </td>
                                              </tr>
                                          )}
                                          <tr className="hover:bg-orange-50/40 transition-colors group">
                                              <td className="px-2 py-1 align-middle">
                                                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                      <span className="font-bold text-slate-800 uppercase text-xs">{item.nombre}</span>
                                                      {item.codigo && <span className="font-mono text-[10px] text-slate-400">[{item.codigo}]</span>}
                                                      <span className="text-[10px] text-orange-600 font-medium">({item.unidad})</span>
                                                      <span className="text-[9px] text-slate-400 font-medium flex items-center gap-0.5"><Warehouse className="h-2.5 w-2.5" />{item.bodega || 'PRINCIPAL'}</span>
                                                  </div>
                                              </td>
                                              <td className="px-1 py-1 text-center align-middle whitespace-nowrap">
                                                  <Button variant="outline" size="sm" onClick={() => openItemHistory(item)} className="h-6 text-[9px] border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold shadow-sm px-1.5 mx-auto">
                                                      <History className="h-3 w-3" />
                                                  </Button>
                                              </td>
                                              <td className="px-2 py-1 align-middle">
                                                  {isAdmin ? (
                                                      <div className="flex items-center justify-center gap-1.5 bg-white p-0.5 rounded-full border border-slate-200 shadow-sm w-fit mx-auto">
                                                          <button onClick={() => updateQuantity(item.id, item.cantidad, -1)} className="h-5 w-5 flex items-center justify-center rounded-full bg-slate-50 hover:bg-red-100 hover:text-red-600 text-slate-500 font-bold transition-colors text-xs">-</button>
                                                          <span className={cn("font-bold w-8 text-center text-xs", item.cantidad <= 5 ? 'text-red-600' : 'text-slate-900')}>{item.cantidad}</span>
                                                          <button onClick={() => updateQuantity(item.id, item.cantidad, 1)} className="h-5 w-5 flex items-center justify-center rounded-full bg-slate-50 hover:bg-green-100 hover:text-green-600 text-slate-500 font-bold transition-colors text-xs">+</button>
                                                      </div>
                                                  ) : (
                                                      <div className="flex justify-center items-center"><span className={cn("font-bold text-xs px-2 py-0.5 rounded-md", item.cantidad <= 5 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-800')}>{item.cantidad}</span></div>
                                                  )}
                                              </td>
                                              <td className="px-2 py-1 text-right font-semibold text-red-700 align-middle text-xs">
                                                  ${Number(item.valor_perdida || 0).toFixed(2)}
                                              </td>
                                              {isAdmin && (
                                                  <td className="px-2 py-1 text-right font-bold text-green-700 align-middle bg-green-50/30 border-l border-slate-100 text-xs">
                                                      ${Number(item.valor_compra || 0).toFixed(2)}
                                                  </td>
                                              )}
                                              {isAdmin && (
                                                  <td className="px-2 py-1 text-slate-600 text-[10px] align-middle bg-green-50/30">
                                                      {item.proveedores || '-'}
                                                  </td>
                                              )}
                                              {isAdmin && !isReadOnly && (
                                                  <td className="px-1 py-1 align-middle">
                                                      <div className="flex justify-center gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                                                          <Button variant="ghost" size="icon" onClick={() => handleOpenModal(item)} className="h-6 w-6 text-blue-600 hover:bg-blue-50" title="Editar"><Edit2 className="h-3.5 w-3.5" /></Button>
                                                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="h-6 w-6 text-red-600 hover:bg-red-50" title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Button>
                                                      </div>
                                                  </td>
                                              )}
                                          </tr>
                                      </React.Fragment>
                                  )})
                              )}
                          </tbody>
                      </table>
                  </div>
                  
                  <div className="px-6 py-3 border-t border-slate-200 bg-white text-xs text-slate-600 flex flex-col sm:flex-row justify-between items-center gap-4 mt-auto">
                      <div>Mostrando registros del <span className="font-semibold">{totalItems > 0 ? startIndex + 1 : 0}</span> al <span className="font-semibold">{endIndex}</span> de un total de <span className="font-semibold">{totalItems}</span> registros</div>
                      <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" className="h-8 px-2 border-slate-300" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                          <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium min-w-[32px] text-center">{currentPage}</div>
                          <Button variant="outline" size="sm" className="h-8 px-2 border-slate-300" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
                      </div>
                  </div>
              </div>
          )}

          {/* -------------------- TAB 2: HISTORIAL GLOBAL -------------------- */}
          {activeTab === 'history' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col animate-in fade-in duration-300">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                     <h3 className="font-bold text-slate-700 flex items-center gap-2"><History className="h-5 w-5 text-orange-500"/> Registro General de Movimientos</h3>
                     <Button variant="outline" size="sm" onClick={fetchGlobalHistory} disabled={globalHistoryLoading} className="bg-white hover:bg-slate-100 shadow-sm border-slate-300"><RefreshCw className={`h-4 w-4 mr-2 ${globalHistoryLoading ? 'animate-spin' : ''}`}/> Actualizar</Button>
                  </div>
                  
                  <div className="p-0 overflow-y-auto flex-1 bg-slate-50/50">
                      {globalHistoryLoading ? (
                          <div className="text-center py-20 text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2"/> Cargando historial general...</div>
                      ) : Object.keys(groupedGlobalHistory).length === 0 ? (
                          <div className="text-center py-20 text-slate-500 italic flex flex-col items-center"><History className="h-10 w-10 text-slate-300 mb-2"/> No hay registros de movimientos en la base de datos.</div>
                      ) : (
                          Object.keys(groupedGlobalHistory).map(dateStr => (
                              <div key={dateStr} className="mb-8">
                                  <div className="bg-slate-800 text-white px-4 py-2 font-bold text-sm sticky top-0 shadow-md z-10 flex items-center gap-2 uppercase tracking-wide">
                                      <CalendarIcon className="h-4 w-4 text-orange-400"/> {dateStr}
                                  </div>
                                  <table className="w-full text-sm text-left">
                                      <thead className="bg-white border-b border-slate-200 text-[11px] uppercase text-slate-500 font-bold">
                                         <tr>
                                            <th className="px-6 py-3 w-24">Hora</th>
                                            <th className="px-6 py-3">Material</th>
                                            <th className="px-6 py-3 text-center">Tipo</th>
                                            <th className="px-6 py-3 text-right">Cantidad</th>
                                            <th className="px-6 py-3 text-right w-24">Stock Final</th>
                                            <th className="px-6 py-3">Usuario</th>
                                            <th className="px-6 py-3">Motivo / Descripción</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                          {groupedGlobalHistory[dateStr].map(reg => (
                                              <tr key={reg.id} className="hover:bg-orange-50/30 transition-colors">
                                                 <td className="px-6 py-3 text-xs text-slate-500 font-mono">{new Date(reg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                                 <td className="px-6 py-3 font-bold text-slate-800 uppercase">{reg.material_nombre}</td>
                                                 <td className="px-6 py-3 text-center"><span className={cn("text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border uppercase tracking-wider", reg.tipo === 'INGRESO' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>{reg.tipo}</span></td>
                                                 <td className={cn("px-6 py-3 text-right font-black text-lg", reg.cantidad_cambio > 0 ? 'text-green-600' : 'text-red-600')}>{reg.cantidad_cambio > 0 ? `+${reg.cantidad_cambio}` : reg.cantidad_cambio}</td>
                                                 <td className="px-6 py-3 text-right font-bold text-slate-900 bg-slate-50/50">{reg.cantidad_resultante}</td>
                                                 <td className="px-6 py-3 text-xs font-semibold text-slate-700 uppercase">{reg.usuario}</td>
                                                 <td className="px-6 py-3 text-xs text-slate-600">{reg.motivo}</td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          )}

          {/* -------------------- ZONA DE MODALES -------------------- */}

          {/* 🔥 MODAL COMPRAS 🔥 */}
          <AnimatePresence>
          {isPurchaseModalOpen && (
              <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                      <div className="bg-emerald-700 p-4 md:p-5 text-white flex justify-between items-center shrink-0">
                          <h3 className="font-bold text-lg flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-emerald-200"/> Registrar Ingreso por Compras</h3>
                          <button onClick={() => setIsPurchaseModalOpen(false)} className="hover:bg-emerald-800 p-1.5 rounded-full transition-colors"><X className="h-5 w-5" /></button>
                      </div>
                      
                      <div className="p-6 overflow-y-auto flex-1 bg-slate-50 min-h-[400px]">
                          {/* 🔧 FIX: el N° Factura y Proveedor es información sensible del
                              negocio (precios negociados por proveedor) — solo Admin debe
                              verlo y registrarlo, por temas de privacidad. */}
                          {isAdmin && (
                              <div className="mb-4 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Nº Factura / Proveedor (Opcional)</label>
                                  <Input className="text-sm py-1.5" value={purchaseRef} onChange={e=>setPurchaseRef(e.target.value)} placeholder="Ej: Factura 001 - Importadora..." />
                              </div>
                          )}

                          <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-600 uppercase block border-b border-slate-200 pb-1">Materiales Adquiridos</label>
                              {purchaseItems.map((pItem, idx) => (
                                  <div key={idx} className={cn("flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm", pItem.isSearching ? "relative z-50 ring-2 ring-emerald-200" : "relative")}>
                                      <div className="flex-1 relative">
                                          <input 
                                             className="w-full text-sm border border-slate-300 rounded px-3 py-2 outline-none focus:border-emerald-500 uppercase font-bold bg-white transition-colors"
                                             placeholder="🔍 Buscar material..."
                                             value={pItem.searchTerm !== undefined ? pItem.searchTerm : (items.find(i => String(i.id) === String(pItem.inventoryId))?.nombre || '')}
                                             onChange={e => {
                                                 const newItems = [...purchaseItems];
                                                 newItems[idx].searchTerm = e.target.value;
                                                 newItems[idx].inventoryId = '';
                                                 newItems[idx].isSearching = true;
                                                 setPurchaseItems(newItems);
                                             }}
                                             onFocus={() => {
                                                 const newItems = [...purchaseItems];
                                                 newItems[idx].isSearching = true;
                                                 setPurchaseItems(newItems);
                                             }}
                                             onBlur={() => setTimeout(() => {
                                                 setPurchaseItems(prev => {
                                                     const newItems = [...prev];
                                                     if (newItems[idx]) newItems[idx].isSearching = false;
                                                     return newItems;
                                                 });
                                             }, 250)}
                                          />
                                          {pItem.isSearching && (
                                              <div className="absolute z-[100] w-full mt-1 bg-white border border-slate-300 rounded-md shadow-xl max-h-64 overflow-y-auto left-0">
                                                  {items.filter(i => i.nombre.toLowerCase().includes((pItem.searchTerm || '').toLowerCase()) || (i.codigo || '').toLowerCase().includes((pItem.searchTerm || '').toLowerCase())).slice(0, 50).map(i => (
                                                      <div 
                                                          key={i.id} 
                                                          className="px-3 py-2 hover:bg-emerald-50 cursor-pointer border-b border-slate-100 transition-colors" 
                                                          onMouseDown={(e) => { 
                                                              e.preventDefault(); 
                                                              const newItems = [...purchaseItems];
                                                              newItems[idx].inventoryId = String(i.id);
                                                              newItems[idx].searchTerm = i.nombre;
                                                              newItems[idx].isSearching = false;
                                                              setPurchaseItems(newItems);
                                                          }}
                                                      >
                                                          <div className="font-bold text-slate-800 uppercase text-xs">{i.nombre}</div>
                                                          <div className="text-[10px] text-slate-500 font-medium">Disp: <span className="font-bold text-slate-700">{i.cantidad}</span> {i.unidad} {i.codigo ? ` | Cód: ${i.codigo}` : ''}</div>
                                                      </div>
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                      <Input type="number" min="1" className="w-24 text-center font-bold text-emerald-700 text-sm py-2" placeholder="Cant." value={pItem.qty} onChange={e => {
                                          const newItems = [...purchaseItems];
                                          newItems[idx].qty = e.target.value;
                                          setPurchaseItems(newItems);
                                      }}/>
                                      <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded shrink-0" onClick={() => {
                                          if(purchaseItems.length > 1) setPurchaseItems(purchaseItems.filter((_, i) => i !== idx));
                                      }}><Trash2 className="h-4 w-4"/></Button>
                                  </div>
                              ))}
                              <Button type="button" variant="outline" size="sm" className="w-full border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 mt-2" onClick={() => setPurchaseItems([...purchaseItems, {inventoryId:'', qty:'', searchTerm:'', isSearching: false}])}><Plus className="h-4 w-4 mr-1"/> Añadir fila</Button>
                          </div>
                      </div>

                      <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                          <Button variant="outline" onClick={() => setIsPurchaseModalOpen(false)}>Cancelar</Button>
                          <Button onClick={handleSavePurchase} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"><ShoppingCart className="h-4 w-4 mr-2"/> {saving ? 'Registrando...' : 'Registrar Ingreso'}</Button>
                      </div>
                  </motion.div>
              </div>
          )}
          </AnimatePresence>

          {/* 🔥 MODAL CONSUMO INTERNO 🔥 */}
          <AnimatePresence>
          {isConsumeModalOpen && (
              <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                      <div className="bg-blue-700 p-4 md:p-5 text-white flex justify-between items-center shrink-0">
                          <h3 className="font-bold text-lg flex items-center gap-2"><PenTool className="h-5 w-5 text-blue-200"/> Registrar Consumo Operativo</h3>
                          <button onClick={() => setIsConsumeModalOpen(false)} className="hover:bg-blue-800 p-1.5 rounded-full transition-colors"><X className="h-5 w-5" /></button>
                      </div>
                      
                      <div className="p-6 overflow-y-auto flex-1 bg-slate-50 min-h-[400px]">
                          <div className="mb-4 bg-white p-3 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-blue-500">
                              <p className="text-[11px] text-slate-500 italic mb-2 leading-snug">Utilice esta ventana para registrar artículos de uso interno o consumibles (ej. Toners, cinta de embalaje).</p>
                              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Motivo / Destino de los materiales *</label>
                              <Input 
                                  value={consumeReason} 
                                  onChange={e=>setConsumeReason(e.target.value)} 
                                  placeholder="Ej: Cambio de toner en impresora de Ventas para OP 000123" 
                                  className="text-sm py-1.5 border-blue-200 focus:ring-blue-500"
                              />
                          </div>

                          <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-600 uppercase block border-b border-slate-200 pb-1">Materiales a Consumir</label>
                              {consumeItems.map((cItem, idx) => (
                                  <div key={idx} className={cn("flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm", cItem.isSearching ? "relative z-50 ring-2 ring-blue-200" : "relative")}>
                                      <div className="flex-1 relative">
                                          <input 
                                             className="w-full text-sm border border-slate-300 rounded px-3 py-2 outline-none focus:border-blue-500 uppercase font-bold bg-white transition-colors"
                                             placeholder="🔍 Buscar material..."
                                             value={cItem.searchTerm !== undefined ? cItem.searchTerm : (items.find(i => String(i.id) === String(cItem.inventoryId))?.nombre || '')}
                                             onChange={e => {
                                                 const newItems = [...consumeItems];
                                                 newItems[idx].searchTerm = e.target.value;
                                                 newItems[idx].inventoryId = '';
                                                 newItems[idx].isSearching = true;
                                                 setConsumeItems(newItems);
                                             }}
                                             onFocus={() => {
                                                 const newItems = [...consumeItems];
                                                 newItems[idx].isSearching = true;
                                                 setConsumeItems(newItems);
                                             }}
                                             onBlur={() => setTimeout(() => {
                                                 setConsumeItems(prev => {
                                                     const newItems = [...prev];
                                                     if (newItems[idx]) newItems[idx].isSearching = false;
                                                     return newItems;
                                                 });
                                             }, 250)}
                                          />
                                          {cItem.isSearching && (
                                              <div className="absolute z-[100] w-full mt-1 bg-white border border-slate-300 rounded-md shadow-xl max-h-64 overflow-y-auto left-0">
                                                  {items.filter(i => i.nombre.toLowerCase().includes((cItem.searchTerm || '').toLowerCase()) || (i.codigo || '').toLowerCase().includes((cItem.searchTerm || '').toLowerCase())).slice(0, 50).map(i => (
                                                      <div 
                                                          key={i.id} 
                                                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100 transition-colors" 
                                                          onMouseDown={(e) => { 
                                                              e.preventDefault(); 
                                                              const newItems = [...consumeItems];
                                                              newItems[idx].inventoryId = String(i.id);
                                                              newItems[idx].searchTerm = i.nombre;
                                                              newItems[idx].isSearching = false;
                                                              setConsumeItems(newItems);
                                                          }}
                                                      >
                                                          <div className="font-bold text-slate-800 uppercase text-xs">{i.nombre}</div>
                                                          <div className="text-[10px] text-slate-500 font-medium">Disp: <span className="font-bold text-slate-700">{i.cantidad}</span> {i.unidad} {i.codigo ? ` | Cód: ${i.codigo}` : ''}</div>
                                                      </div>
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                      <Input type="number" min="1" className="w-24 text-center font-bold text-blue-700 text-sm py-2" placeholder="Cant." value={cItem.qty} onChange={e => {
                                          const newItems = [...consumeItems];
                                          newItems[idx].qty = e.target.value;
                                          setConsumeItems(newItems);
                                      }}/>
                                      <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded shrink-0" onClick={() => {
                                          if(consumeItems.length > 1) setConsumeItems(consumeItems.filter((_, i) => i !== idx));
                                      }}><Trash2 className="h-4 w-4"/></Button>
                                  </div>
                              ))}
                              <Button type="button" variant="outline" size="sm" className="w-full border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 mt-2" onClick={() => setConsumeItems([...consumeItems, {inventoryId:'', qty:'', searchTerm:'', isSearching: false}])}><Plus className="h-4 w-4 mr-1"/> Añadir fila</Button>
                          </div>
                      </div>

                      <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                          <Button variant="outline" onClick={() => setIsConsumeModalOpen(false)}>Cancelar</Button>
                          <Button onClick={handleSaveConsume} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold"><PenTool className="h-4 w-4 mr-2"/> {saving ? 'Registrando...' : 'Registrar Consumo'}</Button>
                      </div>
                  </motion.div>
              </div>
          )}
          </AnimatePresence>

          {/* 🔥 MODAL CUADRE INVENTARIO 🔥 */}
          <AnimatePresence>
          {isAdjustModalOpen && (
              <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                      <div className="bg-amber-600 p-4 md:p-5 text-white flex justify-between items-center shrink-0">
                          <h3 className="font-bold text-lg flex items-center gap-2"><Scale className="h-5 w-5 text-amber-200"/> Cuadre de Inventario (Auditoría)</h3>
                          <button onClick={() => setIsAdjustModalOpen(false)} className="hover:bg-amber-700 p-1.5 rounded-full transition-colors"><X className="h-5 w-5" /></button>
                      </div>
                      
                      <div className="p-6 overflow-y-auto flex-1 bg-slate-50 min-h-[400px]">
                          <div className="space-y-3">
                              <div className="grid grid-cols-12 gap-2 px-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                  <div className="col-span-5">Material a cuadrar</div>
                                  <div className="col-span-1 text-center" title="Stock en el Sistema">Sis.</div>
                                  <div className="col-span-2 text-center" title="Stock Físico Real">Físico</div>
                                  <div className="col-span-3">Justificación / Motivo</div>
                                  <div className="col-span-1 text-center"></div>
                              </div>
                              {adjustItems.map((aItem, idx) => {
                                  const targetItem = items.find(i => String(i.id) === String(aItem.inventoryId));
                                  const sysQty = targetItem ? targetItem.cantidad : '-';
                                  let diff = 0;
                                  if(targetItem && aItem.newQty !== '') {
                                      diff = parseInt(aItem.newQty, 10) - targetItem.cantidad;
                                  }

                                  return (
                                      <div key={idx} className={cn("grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm", aItem.isSearching ? "relative z-50 ring-2 ring-amber-200" : "relative")}>
                                          <div className="col-span-5 relative">
                                              <input 
                                                 className="w-full text-sm border border-slate-300 rounded px-3 py-2 outline-none focus:border-amber-500 uppercase font-bold bg-white transition-colors"
                                                 placeholder="🔍 Buscar material..."
                                                 value={aItem.searchTerm !== undefined ? aItem.searchTerm : (items.find(i => String(i.id) === String(aItem.inventoryId))?.nombre || '')}
                                                 onChange={e => {
                                                     const newItems = [...adjustItems];
                                                     newItems[idx].searchTerm = e.target.value;
                                                     newItems[idx].inventoryId = '';
                                                     newItems[idx].isSearching = true;
                                                     setAdjustItems(newItems);
                                                 }}
                                                 onFocus={() => {
                                                     const newItems = [...adjustItems];
                                                     newItems[idx].isSearching = true;
                                                     setAdjustItems(newItems);
                                                 }}
                                                 onBlur={() => setTimeout(() => {
                                                     setAdjustItems(prev => {
                                                         const newItems = [...prev];
                                                         if (newItems[idx]) newItems[idx].isSearching = false;
                                                         return newItems;
                                                     });
                                                 }, 250)}
                                              />
                                              {aItem.isSearching && (
                                                  <div className="absolute z-[100] w-[110%] mt-1 bg-white border border-slate-300 rounded-md shadow-xl max-h-64 overflow-y-auto left-0">
                                                      {items.filter(i => i.nombre.toLowerCase().includes((aItem.searchTerm || '').toLowerCase()) || (i.codigo || '').toLowerCase().includes((aItem.searchTerm || '').toLowerCase())).slice(0, 50).map(i => (
                                                          <div 
                                                              key={i.id} 
                                                              className="px-3 py-2 hover:bg-amber-50 cursor-pointer border-b border-slate-100 transition-colors" 
                                                              onMouseDown={(e) => { 
                                                                  e.preventDefault(); 
                                                                  const newItems = [...adjustItems];
                                                                  newItems[idx].inventoryId = String(i.id);
                                                                  newItems[idx].searchTerm = i.nombre;
                                                                  newItems[idx].isSearching = false;
                                                                  setAdjustItems(newItems);
                                                              }}
                                                          >
                                                              <div className="font-bold text-slate-800 uppercase text-xs">{i.nombre}</div>
                                                              <div className="text-[10px] text-slate-500 font-medium mt-0.5">Disp: <span className="font-bold text-slate-700">{i.cantidad}</span> {i.unidad} {i.codigo ? ` | Cód: ${i.codigo}` : ''}</div>
                                                          </div>
                                                      ))}
                                                  </div>
                                              )}
                                          </div>
                                          <div className="col-span-1 text-center font-bold text-slate-400 text-sm bg-slate-50 rounded border border-slate-200 py-1.5">{sysQty}</div>
                                          <div className="col-span-2 relative">
                                              <Input type="number" min="0" className="w-full text-center font-bold text-sm py-1.5" placeholder="0" value={aItem.newQty} onChange={e => {
                                                  const newItems = [...adjustItems];
                                                  newItems[idx].newQty = e.target.value;
                                                  setAdjustItems(newItems);
                                              }}/>
                                              {targetItem && aItem.newQty !== '' && diff !== 0 && (
                                                  <span className={cn("absolute -top-2 -right-2 text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm z-10", diff > 0 ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
                                                      {diff > 0 ? `+${diff}` : diff}
                                                  </span>
                                              )}
                                          </div>
                                          <div className="col-span-3">
                                              <Input className="w-full text-xs font-medium py-2 italic" placeholder="Ej: Error de conteo..." value={aItem.reason} onChange={e => {
                                                  const newItems = [...adjustItems];
                                                  newItems[idx].reason = e.target.value;
                                                  setAdjustItems(newItems);
                                              }}/>
                                          </div>
                                          <div className="col-span-1 flex justify-center">
                                              <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-100 hover:text-red-700 rounded shrink-0" onClick={() => {
                                                  if(adjustItems.length > 1) setAdjustItems(adjustItems.filter((_, i) => i !== idx));
                                              }}><Trash2 className="h-4 w-4"/></Button>
                                          </div>
                                      </div>
                                  );
                              })}
                              <Button type="button" variant="outline" size="sm" className="w-full border-dashed border-amber-300 text-amber-700 hover:bg-amber-50 mt-2" onClick={() => setAdjustItems([...adjustItems, {inventoryId:'', newQty:'', reason:'', searchTerm:'', isSearching: false}])}><Plus className="h-4 w-4 mr-1"/> Añadir fila</Button>
                          </div>
                      </div>

                      <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-between items-center shrink-0">
                          <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-lg flex items-center gap-3 shadow-sm">
                              <span className="text-xs font-bold text-red-800 uppercase tracking-wider">Pérdida monetaria:</span>
                              <span className="text-lg font-black text-red-600">${calculateTotalLoss().toFixed(2)}</span>
                          </div>
                          <div className="flex gap-3">
                              <Button variant="outline" onClick={() => setIsAdjustModalOpen(false)}>Cancelar</Button>
                              <Button onClick={handleSaveAdjust} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2"/>} Ejecutar Cuadre</Button>
                          </div>
                      </div>
                  </motion.div>
              </div>
          )}
          </AnimatePresence>

          {/* Modal Bodegas */}
          <AnimatePresence>
          {isBodegasModalOpen && isAdmin && (
              <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                      <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                          <h3 className="font-bold text-lg flex items-center gap-2"><Settings className="h-5 w-5 text-orange-400"/> Gestión de Bodegas</h3>
                          <button onClick={() => setIsBodegasModalOpen(false)} className="hover:bg-slate-700 p-1.5 rounded-full transition-colors"><X className="h-5 w-5" /></button>
                      </div>
                      <div className="p-6 space-y-5 bg-slate-50/50">
                          <div className="flex gap-2">
                              <Input value={newBodegaName} onChange={e => setNewBodegaName(e.target.value)} placeholder="Nombre de nueva bodega..." className="font-bold uppercase" />
                              <Button onClick={handleAddBodega} disabled={bodegaLoading} className="bg-green-600 hover:bg-green-700 font-bold"><Plus className="h-4 w-4 mr-1"/> Añadir</Button>
                          </div>
                          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                              {bodegasList.map(bod => (
                                  <div key={bod.id} className="flex justify-between items-center bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                                      {editingBodegaId === bod.id ? (
                                          <div className="flex gap-2 w-full">
                                              <Input value={editBodegaName} onChange={e => setEditBodegaName(e.target.value)} className="h-9 font-bold uppercase" autoFocus/>
                                              <Button size="icon" className="h-9 w-9 bg-blue-600 hover:bg-blue-700 shrink-0" onClick={() => handleSaveEditBodega(bod)} disabled={bodegaLoading}><Check className="h-4 w-4"/></Button>
                                              <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setEditingBodegaId(null)}><X className="h-4 w-4"/></Button>
                                          </div>
                                      ) : (
                                          <>
                                              <div className="flex items-center gap-2">
                                                  <Warehouse className="h-4 w-4 text-slate-400" />
                                                  <span className="font-bold uppercase text-slate-800 tracking-wide">{bod.nombre}</span>
                                              </div>
                                              {bod.nombre !== 'PRINCIPAL' && (
                                                  <div className="flex gap-1">
                                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 bg-blue-50" onClick={() => {setEditingBodegaId(bod.id); setEditBodegaName(bod.nombre);}}><Edit2 className="h-3.5 w-3.5"/></Button>
                                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 bg-red-50" onClick={() => handleDeleteBodega(bod)} disabled={bodegaLoading}><Trash2 className="h-3.5 w-3.5"/></Button>
                                                  </div>
                                              )}
                                          </>
                                      )}
                                  </div>
                              ))}
                          </div>
                      </div>
                  </motion.div>
              </div>
          )}
          </AnimatePresence>

          {/* Modal Crear/Editar Material */}
          <AnimatePresence>
          {isModalOpen && isAdmin && !isReadOnly && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                      <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                          <h3 className="font-bold text-lg flex items-center gap-2"><Package className="h-5 w-5 text-orange-400"/> {editingItem ? 'Editar Material' : 'Nuevo Material'}</h3>
                          <button onClick={() => setIsModalOpen(false)} className="hover:bg-slate-700 p-1.5 rounded-full transition-colors"><X className="h-5 w-5" /></button>
                      </div>
                      <div className="p-6 space-y-5">
                          <div className="grid grid-cols-2 gap-5">
                              <div className="col-span-2">
                                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Nombre del Material *</label>
                                  <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: Lona Vinilica Blanca" className="font-medium text-sm" />
                              </div>

                              <div className="col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Warehouse className="h-3 w-3" /> Asignar a Bodega *</label>
                                  <select 
                                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase"
                                      value={formData.bodega} 
                                      onChange={e => setFormData({...formData, bodega: e.target.value})} 
                                  >
                                      {bodegasList.map(bod => <option key={bod.id} value={bod.nombre}>{bod.nombre}</option>)}
                                  </select>
                              </div>

                              <div>
                                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Código (Opcional)</label>
                                  <Input value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})} placeholder="Ej: P001" className="font-mono text-sm" />
                              </div>
                              <div>
                                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Categoría</label>
                                  <input list="category-list" className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500" value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} placeholder="Selecciona o escribe..." />
                                  <datalist id="category-list">{categories.map(cat => <option key={cat} value={cat} />)}</datalist>
                              </div>
                              <div>
                                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Cantidad Inicial *</label>
                                  <Input 
                                    type="number" 
                                    min="0" 
                                    step="1" 
                                    value={formData.cantidad} 
                                    onChange={e => setFormData({...formData, cantidad: e.target.value})} 
                                    onKeyDown={e => {
                                        if (e.key === '.' || e.key === ',') e.preventDefault();
                                    }}
                                    className="font-bold text-lg text-slate-800" 
                                  />
                              </div>
                              <div>
                                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Unidad de Medida</label>
                                  <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-orange-500 h-10 font-medium text-slate-700" value={formData.unidad} onChange={e => setFormData({...formData, unidad: e.target.value})}>
                                      <option value="Unidades">Unidades</option><option value="Metros">Metros (m)</option><option value="Rollos">Rollos</option><option value="Litros">Litros (L)</option><option value="Cajas">Cajas</option><option value="Planchas">Planchas</option>
                                  </select>
                              </div>
                              
                              <div className="col-span-2">
                                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Valor Dscto. x Pérdida</label>
                                  <div className="relative">
                                      <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
                                      <Input type="number" step="0.01" min="0" className="pl-7 text-sm font-bold" value={formData.valor_perdida} onChange={e => setFormData({...formData, valor_perdida: e.target.value})} />
                                  </div>
                              </div>

                              {isAdmin && (
                                  <div className="col-span-2 border-t border-slate-200 mt-2 pt-4 grid grid-cols-2 gap-5">
                                      <div>
                                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1"><DollarSign className="h-3 w-3 text-green-600"/> Costo Real (Admin)</label>
                                          <div className="relative">
                                              <span className="absolute left-3 top-2 text-green-600 font-bold">$</span>
                                              <Input type="number" step="0.01" min="0" className="pl-7 text-sm font-bold border-green-300 bg-green-50 text-green-800" value={formData.valor_compra} onChange={e => setFormData({...formData, valor_compra: e.target.value})} />
                                          </div>
                                      </div>
                                      <div>
                                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block text-green-700">Proveedores (Admin)</label>
                                          <Input className="text-sm border-green-300 bg-green-50" placeholder="Ej: Importadora XY..." value={formData.proveedores} onChange={e => setFormData({...formData, proveedores: e.target.value})} />
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                      <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3">
                          <Button variant="outline" onClick={() => setIsModalOpen(false)} className="font-semibold">Cancelar</Button>
                          <Button onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2"/>} {editingItem ? 'Actualizar' : 'Guardar Material'}</Button>
                      </div>
                  </motion.div>
              </div>
          )}
          </AnimatePresence>

          {/* Modal Historial por Item */}
          <AnimatePresence>
          {isHistoryModalOpen && (
              <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
                      <div className="bg-slate-800 p-4 text-white flex justify-between items-center shrink-0">
                          <h3 className="font-bold text-lg flex items-center gap-2"><History className="h-5 w-5 text-indigo-400"/> Movimientos: {editingItem?.nombre}</h3>
                          <button onClick={() => setIsHistoryModalOpen(false)} className="hover:bg-slate-700 p-1.5 rounded-full transition-colors"><X className="h-5 w-5" /></button>
                      </div>
                      <div className="p-0 overflow-y-auto flex-1 bg-slate-50">
                          {itemHistoryLoading ? (
                              <div className="flex flex-col items-center justify-center py-20 text-slate-500"><Loader2 className="h-8 w-8 animate-spin mb-2"/> Cargando historial...</div>
                          ) : itemHistoryData.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-20 text-slate-500"><History className="h-10 w-10 text-slate-300 mb-2"/> <span className="font-medium text-lg">Sin historial</span><span className="text-sm">Aún no hay movimientos registrados.</span></div>
                          ) : (
                              <table className="w-full text-sm text-left">
                                  <thead className="bg-slate-200 text-slate-700 text-xs uppercase sticky top-0 shadow-sm border-b border-slate-300">
                                      <tr>
                                          <th className="px-4 py-2">Fecha y Hora</th>
                                          <th className="px-4 py-2 text-center">Tipo</th>
                                          <th className="px-4 py-2 text-right">Variación</th>
                                          <th className="px-4 py-2 text-right">Stock Final</th>
                                          <th className="px-4 py-2">Usuario</th>
                                          <th className="px-4 py-2">Motivo</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200 bg-white">
                                      {itemHistoryData.map((reg) => (
                                          <tr key={reg.id} className="hover:bg-slate-50">
                                              <td className="px-4 py-2 text-xs whitespace-nowrap text-slate-600">{new Date(reg.created_at).toLocaleString()}</td>
                                              <td className="px-4 py-2 text-center"><span className={cn("text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border uppercase tracking-wider", reg.tipo === 'INGRESO' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>{reg.tipo}</span></td>
                                              <td className={cn("px-4 py-2 text-right font-black", reg.cantidad_cambio > 0 ? 'text-green-600' : 'text-red-600')}>{reg.cantidad_cambio > 0 ? `+${reg.cantidad_cambio}` : reg.cantidad_cambio}</td>
                                              <td className="px-4 py-2 text-right font-bold text-slate-900 bg-slate-50/50">{reg.cantidad_resultante}</td>
                                              <td className="px-4 py-2 font-bold text-slate-700 text-xs uppercase">{reg.usuario}</td>
                                              <td className="px-4 py-2 text-xs text-slate-600 italic">{reg.motivo}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          )}
                      </div>
                  </motion.div>
              </div>
          )}
          </AnimatePresence>
      </div>

      {/* -------------------- VISTA DE IMPRESIÓN -------------------- */}
      <div className="hidden print:block font-sans text-black bg-white min-h-screen">
          <style>{`
            @page { size: portrait; margin: 10mm; }
            @media print {
              body * { visibility: hidden; }
              .print\\:block, .print\\:block * { visibility: visible; }
              .print\\:block { position: absolute; left: 0; top: 0; width: 100%; }
            }
          `}</style>

          <div className="mb-6 border-b-2 border-slate-800 pb-2 flex justify-between items-end">
              <div>
                  <h1 className="text-2xl font-black tracking-widest uppercase text-slate-900">
                     {printType === 'audit' ? 'Auditoría Física de Inventario' : 'Reporte de Inventario'}
                  </h1>
                  <p className="text-sm text-slate-600 mt-1 font-medium">ADRCOMPANY SAS</p>
              </div>
              <div className="text-right">
                  <p className="text-sm font-bold">Fecha: {new Date().toLocaleDateString()}</p>
                  <p className="text-xs text-slate-500 mt-1">Impreso por: {user?.name || 'Sistema'}</p>
              </div>
          </div>
          
          {(selectedBodega || selectedCategory || searchTerm) && (
              <div className="mb-4 bg-slate-100 p-2 rounded border border-slate-300 text-xs text-slate-700">
                  <span className="font-bold uppercase tracking-wider">Filtros activos:</span>
                  {selectedBodega && <span className="ml-2 font-medium bg-white px-1 border border-slate-200 rounded">Bodega: {selectedBodega}</span>}
                  {selectedCategory && <span className="ml-2 font-medium bg-white px-1 border border-slate-200 rounded">Categoría: {selectedCategory}</span>}
                  {searchTerm && <span className="ml-2 font-medium bg-white px-1 border border-slate-200 rounded">Búsqueda: "{searchTerm}"</span>}
              </div>
          )}

          <table className="w-full text-xs border-collapse border-2 border-slate-800">
              <thead>
                  <tr className="bg-slate-200 border-b-2 border-slate-800">
                      <th className="p-1 border-r border-slate-400 text-center w-8 font-bold">N°</th>
                      <th className="p-1 border-r border-slate-400 text-left font-bold">Material / Código / Bodega</th>
                      <th className="p-1 border-r border-slate-400 text-center w-16 font-bold leading-tight">Stock<br/>Sist.</th>
                      
                      {printType === 'audit' && (
                          <>
                              <th className="p-1 border-r border-slate-400 text-center w-20 font-bold leading-tight bg-white">Stock<br/>Físico</th>
                              <th className="p-1 text-right w-20 font-bold leading-tight">Valor<br/>Pérdida</th>
                          </>
                      )}
                  </tr>
              </thead>
              <tbody>
                  {processedItems.map((item, idx) => {
                      // 🔧 CAMBIO DE DISEÑO: igual que en pantalla, la categoría ya no se
                      // repite en cada fila — sale una sola vez como encabezado de grupo.
                      const prevItem = processedItems[idx - 1];
                      const showCategoryHeader = !prevItem || (prevItem.categoria || '') !== (item.categoria || '');
                      return (
                      <React.Fragment key={item.id}>
                          {showCategoryHeader && (
                              <tr className="bg-slate-100">
                                  <td colSpan={printType === 'audit' ? 5 : 3} className="p-1 text-[10px] font-black uppercase tracking-wide text-slate-600 border-b border-slate-400">
                                      {item.categoria || 'SIN CATEGORÍA'}
                                  </td>
                              </tr>
                          )}
                          <tr className="border-b border-slate-300">
                              <td className="p-1 border-r border-slate-400 text-center text-[10px] text-slate-500">{idx + 1}</td>
                              <td className="p-1 border-r border-slate-400 uppercase leading-tight">
                                  <span className="font-bold text-[11px]">{item.nombre}</span>
                                  {item.codigo && <span className="text-[9px] text-slate-500 ml-1 font-mono">[{item.codigo}]</span>}
                                  <span className="text-[9px] text-slate-500 font-medium ml-1">— {item.bodega || 'PRINCIPAL'} ({item.unidad})</span>
                              </td>
                              <td className={cn("p-1 text-center font-bold text-sm bg-slate-100/50", printType === 'audit' ? "border-r border-slate-400" : "")}>
                                  {item.cantidad}
                              </td>
                              
                              {printType === 'audit' && (
                                  <>
                                      <td className="p-1 border-r border-slate-400 text-center"></td>
                                      <td className="p-1 text-right font-medium text-[10px]">
                                          ${Number(item.valor_perdida || 0).toFixed(2)}
                                      </td>
                                  </>
                              )}
                          </tr>
                      </React.Fragment>
                  )})}
                  {processedItems.length === 0 && (
                      <tr>
                          <td colSpan={printType === 'audit' ? "5" : "3"} className="p-4 text-center text-slate-500 italic">No hay productos en esta vista.</td>
                      </tr>
                  )}
              </tbody>
          </table>
          
          {printType === 'audit' && (
              <div className="mt-16 flex justify-around px-20">
                  <div className="text-center w-64">
                      <div className="border-t border-slate-800 pt-2 font-bold text-sm">Firma de Producción</div>
                      <div className="text-xs text-slate-500 mt-1">Responsable del área</div>
                  </div>
                  <div className="text-center w-64">
                      <div className="border-t border-slate-800 pt-2 font-bold text-sm">Firma de Administración</div>
                      <div className="text-xs text-slate-500 mt-1">Revisado y aprobado</div>
                  </div>
              </div>
          )}
      </div>
    </>
  );
};

export default InventoryPanel;