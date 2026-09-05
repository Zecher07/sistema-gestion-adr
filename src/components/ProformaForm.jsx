import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Save, X, Plus, Trash2, User, Search, Calculator, FileText, Loader2, UserPlus, Mail, Clock, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import ClientForm from './ClientForm';
import { getValidSellers, formatResponsableName, removeDuplicateUsers } from '@/lib/utils';

// --- 🔥 FUNCIÓN PARA COMPRIMIR IMÁGENES 🔥 ---
// 🔧 FIX: antes esto devolvía un dataURL base64 gigante que se guardaba directo en la
// fila de la proforma (columna 'imagenes'). Con 2-3 fotos, el payload se volvía tan
// pesado que la petición a Supabase fallaba — y como el código no revisaba el error,
// mostraba "Guardado" igual, aunque nunca se guardó nada. Ahora comprimimos a un Blob
// y lo subimos a Storage; en la proforma solo se guarda la URL (unos bytes).
const compressImageToBlob = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => {
                        if (!blob) { reject(new Error('No se pudo comprimir la imagen')); return; }
                        resolve({ name: file.name, blob });
                    },
                    'image/jpeg',
                    0.7
                );
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

// Sube el blob comprimido al bucket 'proformas-imagenes' y devuelve { name, url } con la
// URL pública. Requiere que exista ese bucket público en Supabase Storage.
const uploadProformaImage = async (folderId, blobData) => {
    const fileName = `${folderId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    const { error: uploadError } = await supabase
        .storage
        .from('proformas-imagenes')
        .upload(fileName, blobData.blob, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase
        .storage
        .from('proformas-imagenes')
        .getPublicUrl(fileName);

    return { name: blobData.name, url: publicUrlData.publicUrl };
};

// 🔧 separa "NOMBRE DEL PRODUCTO - descripción extra" en sus dos partes
// (mismo criterio que en OrderForm.jsx y en las impresiones).
const getDescPartsForm = (textoCompleto) => {
    if (!textoCompleto) return { nombre: '', detalle: '' };
    const idx = textoCompleto.indexOf(' - ');
    if (idx === -1) return { nombre: textoCompleto, detalle: '' };
    return { nombre: textoCompleto.slice(0, idx).trim(), detalle: textoCompleto.slice(idx + 3).trim() };
};

const ProformaForm = ({ onSuccess, onCancel, clients = [], staffUsers = [], user, initialData = null, nextProformaNumber, onCreateClient, onReloadClients }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  const [titulo, setTitulo] = useState(''); 
  const [diasEntrega, setDiasEntrega] = useState(''); 
  const [responsable, setResponsable] = useState(user?.name || '');
  
  // 🔥 CORRECCIÓN: Estado local para manejar los clientes 🔥
  const [localClients, setLocalClients] = useState(clients);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [selectedClient, setSelectedClient] = useState({ nombre: '', identificacion: '', telefono: '', direccion: '', email: '' });

  const [products, setProducts] = useState([
    { cantidad: 1, descripcion: '', observaciones: '', precioUnitario: 0, total: 0, base: '', altura: '', venta_minima: 1, precios_escalonados: [], precioBaseOriginal: 0, es_por_metro: false, precio_minimo: 0, precioMinimoManual: '' }
  ]);
  
  const [imagenes, setImagenes] = useState([]);

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState([]);
  const [searchCatalog, setSearchCatalog] = useState('');

  const [activeProductSearchRow, setActiveProductSearchRow] = useState(null);
  const [editingProductRow, setEditingProductRow] = useState(null);
  const [productSuggestions, setProductSuggestions] = useState([]);

  const [financials, setFinancials] = useState({ subtotal: 0, iva: 0, total: 0, descuento: 0, descuentoPorc: 0, anticipoPorc: 50, anticipoValor: 0, saldoPorc: 50, saldoValor: 0 });
  const [notes, setNotes] = useState('');
  const [ivaPercentage, setIvaPercentage] = useState(15); 
  const [applyIva, setApplyIva] = useState(false);
  const [preciosIncluyenIva, setPreciosIncluyenIva] = useState(true); // 🔧 SINCRONIZADO CON ORDERFORM: por defecto sí incluyen IVA

  const [localDiscountVal, setLocalDiscountVal] = useState('');
  const [localDiscountPercent, setLocalDiscountPercent] = useState('');
  
  const [esMayorista, setEsMayorista] = useState(false);

  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const newClientInitialData = useMemo(() => { return showNewClientModal ? { nombre: clientSearch } : null; }, [showNewClientModal]);

  const isAdmin = user?.role === 'Administrador';
  const validSellers = useMemo(() => removeDuplicateUsers(getValidSellers(staffUsers)), [staffUsers]);

  const findClientId = (c) => { if (!c) return ''; return c.ruc || c.cedula || c.identificacion || c.dni || c.empresa || ''; };

  useEffect(() => { setLocalClients(clients); }, [clients]);

  useEffect(() => { const fetchCatalog = async () => { const { data } = await supabase.from('catalogo_productos').select('*').order('nombre'); if (data) setCatalogItems(data); }; fetchCatalog(); }, []);

  useEffect(() => {
    const fetchGlobalConfig = async () => {
      try {
        if (initialData) { 
            setIvaPercentage(initialData.ivaPercentage || initialData.iva_percentage || 15); 
            setApplyIva((initialData.iva_total || initialData.iva) > 0); 
            // 🔧 SINCRONIZADO CON ORDERFORM: proformas viejas (antes de este cambio) no
            // tenían precios incluidos, así que por defecto se leen como "no incluido"
            // salvo que el campo ya exista guardado explícitamente.
            setPreciosIncluyenIva(initialData.preciosIncluyenIva !== undefined ? initialData.preciosIncluyenIva : false);
            return; 
        }
        const { data } = await supabase.from('configuracion_global').select('iva_porcentaje').single(); if (data) setIvaPercentage(data.iva_porcentaje);
      } catch (error) { console.error(error); }
    }; fetchGlobalConfig();
  }, [initialData]);

  useEffect(() => {
    if (initialData) {
      setTitulo(initialData.titulo || initialData.tipo_trabajo || ''); setClientSearch(initialData.cliente_nombre || '');
      setSelectedClient({ nombre: initialData.cliente_nombre || '', identificacion: initialData.cliente_identificacion || '', telefono: initialData.cliente_telefono || '', direccion: initialData.cliente_direccion || '', email: initialData.cliente_email || '' });
      
      const items = Array.isArray(initialData.items) ? initialData.items : [];
      setProducts(items.length > 0 ? items.map(p => ({
          ...p,
          precioUnitario: p.precioUnitario !== undefined ? p.precioUnitario : p.precio || 0,
          base: p.base || '',
          altura: p.altura || '',
          cantidad: p.cantidad !== undefined ? p.cantidad : 1
      })) : [{ cantidad: 1, descripcion: '', observaciones: '', precioUnitario: 0, total: 0, base: '', altura: '', venta_minima: 1, precios_escalonados: [], precioBaseOriginal: 0, es_por_metro: false, precio_minimo: 0, precioMinimoManual: '' }]);
      
      setNotes(initialData.notas || ''); setDiasEntrega(initialData.financials?.diasEntrega || initialData.dias_entrega || '');
      setResponsable(initialData.responsable_nombre || user?.name || '');
      
      setEsMayorista(initialData.esMayorista || initialData.es_mayorista || false);
      setImagenes(initialData.imagenes || []);

      if (initialData.financials) { 
          const dMonto = initialData.financials.descuentoMonto || 0;
          setFinancials(prev => ({ 
              ...prev, 
              descuentoMonto: dMonto,
              descuento: initialData.financials.descuento || 0, 
              anticipoPorc: initialData.financials.anticipoPorc || 50 
          })); 
          setLocalDiscountVal(dMonto > 0 ? dMonto.toFixed(2) : '');
      }
    }
  }, [initialData, user]);

  // 🔧 SINCRONIZADO CON ORDERFORM: misma matemática de "precios incluyen IVA",
  // adaptada al sistema de descuentos propio de Proforma (que Orden no tiene).
  useEffect(() => {
    const subtotalBruto = products.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
    const descuentoDirectoTotal = Number(financials.descuentoMonto) || 0;
    const tasaIva = applyIva ? (ivaPercentage / 100) : 0;
    const isIvaIncluded = preciosIncluyenIva;

    let subtotalNeto = 0;
    let iva = 0;
    let total = 0;
    let descuentoBase = 0;

    if (applyIva) {
        if (isIvaIncluded) {
            // Los precios ingresados YA incluyen IVA: el total es directo,
            // y el sistema despeja cuál fue la base imponible y el IVA.
            total = Math.max(0, subtotalBruto - descuentoDirectoTotal);
            subtotalNeto = total / (1 + tasaIva);
            iva = total - subtotalNeto;
            descuentoBase = descuentoDirectoTotal / (1 + tasaIva);
        } else {
            // Funcionamiento clásico: los precios son netos, el IVA se suma al final
            descuentoBase = descuentoDirectoTotal;
            subtotalNeto = Math.max(0, subtotalBruto - descuentoBase);
            iva = subtotalNeto * tasaIva;
            total = subtotalNeto + iva;
        }
    } else {
        descuentoBase = descuentoDirectoTotal;
        subtotalNeto = Math.max(0, subtotalBruto - descuentoBase);
        iva = 0;
        total = subtotalNeto;
    }

    const anticipoValor = total * ((financials.anticipoPorc || 0) / 100);
    const saldoPorc = 100 - (financials.anticipoPorc || 0); 
    const saldoValor = total - anticipoValor;
    
    setFinancials(prev => ({ 
        ...prev, 
        subtotal: subtotalBruto, 
        descuento: descuentoBase, 
        iva, 
        total, 
        anticipoValor, 
        saldoPorc, 
        saldoValor 
    }));

    if (document.activeElement?.name !== 'proformaPercentInput') {
        const perc = subtotalBruto > 0 ? (descuentoBase / subtotalBruto) * 100 : 0;
        setLocalDiscountPercent(perc > 0 ? perc.toFixed(2) : '');
    }
  }, [products, ivaPercentage, applyIva, preciosIncluyenIva, financials.descuentoMonto, financials.anticipoPorc]);

  const handleAddImages = async (e) => {
      const files = Array.from(e.target.files);
      if(!files.length) return;
      setIsLoadingImages(true);
      const newImages = [];
      for (const file of files) {
          try {
              const compressed = await compressImageToBlob(file);
              // previewUrl es solo para mostrar la miniatura en este navegador (no se guarda en la BD)
              const previewUrl = URL.createObjectURL(compressed.blob);
              newImages.push({ ...compressed, previewUrl });
          } catch (error) { console.error(error); }
      }
      setImagenes(prev => [...prev, ...newImages]);
      setIsLoadingImages(false);
  };

  const removeImage = (index) => {
      setImagenes(prev => prev.filter((_, i) => i !== index));
  };

  const filteredClients = localClients.filter(c => c.nombre.toLowerCase().includes(clientSearch.toLowerCase()) || (c.empresa && c.empresa.toLowerCase().includes(clientSearch.toLowerCase())));
  
  // 🔧 SINCRONIZADO CON ORDERFORM: redondea hacia arriba en incrementos de $0.50,
  // para que los totales por metro cuadrado se vean igual que en una orden real.
  const roundUpToHalf = (num) => Math.ceil(num * 2) / 2;

  const getPriceForQty = (qty, item, applyMayorista = false) => {
      if (applyMayorista) {
          const tiersDist = [...(item.precios_distribuidor || [])].sort((a,b) => b.cantidad - a.cantidad);
          const tierDist = tiersDist.find(t => qty >= t.cantidad);
          if (tierDist && Number(tierDist.precio) > 0) return Number(tierDist.precio);
          
          const baseDist = Number(item.precioDistribuidorBase || item.precio_distribuidor || 0);
          if (baseDist > 0) return baseDist;
      }

      const tiersNorm = [...(item.precios_escalonados || [])].sort((a,b) => b.cantidad - a.cantidad);
      const tierNorm = tiersNorm.find(t => qty >= t.cantidad);
      if (tierNorm && Number(tierNorm.precio) > 0) return Number(tierNorm.precio);
      
      return Number(item.precioBaseOriginal || item.precio || 0);
  };

  const recalculatePrices = (itemsList, isWholesale) => {
      return itemsList.map(p => {
          if (!p.descripcion) return p;
          const q = parseFloat(p.cantidad) || 0;
          const minCatalogo = Number(p.precio_minimo) > 0 ? Number(p.precio_minimo) : getPriceForQty(1, p, isWholesale);
          const PRECIO_MINIMO_ITEM = p.precioMinimoManual !== undefined && p.precioMinimoManual !== ''
              ? parseFloat(p.precioMinimoManual) : minCatalogo;
          
          if (p.es_por_metro) {
              const b = parseFloat(p.base) || 0;
              const a = parseFloat(p.altura) || 0;
              const areaIndividual = (b/100) * (a/100);
              const areaTotal = parseFloat((areaIndividual * q).toFixed(2));
              
              const newPrice = getPriceForQty(areaTotal, p, isWholesale);
              
              let precioPorPieza = areaIndividual * newPrice;
              if (areaIndividual > 0 && precioPorPieza < PRECIO_MINIMO_ITEM) {
                  precioPorPieza = PRECIO_MINIMO_ITEM;
              }
              
              let calcTotal = precioPorPieza * q;
              if (calcTotal > 0) calcTotal = roundUpToHalf(calcTotal);
              
              return { ...p, precioUnitario: areaTotal > 0 ? newPrice : '', total: calcTotal };
          } else {
              const newPrice = getPriceForQty(q, p, isWholesale);
              return { ...p, precioUnitario: newPrice, total: parseFloat((q * newPrice).toFixed(2)) };
          }
      });
  };

  const handleClientSelect = (client) => { 
      const idFound = findClientId(client); 
      const isWholesale = client.es_mayorista || false;

      setSelectedClient({ 
          nombre: client.nombre || client.razonSocial || client.full_name, 
          identificacion: idFound, 
          telefono: client.telefono || client.celular || '', 
          direccion: client.direccion || '', 
          email: client.email || client.correo || '' 
      }); 
      setClientSearch(client.nombre || client.razonSocial || client.full_name); 
      setShowClientSuggestions(false); 
      
      setEsMayorista(isWholesale);
      setProducts(prev => recalculatePrices(prev, isWholesale));
  };

  const handleNewClientCreated = (newClient) => {
    const clientData = Array.isArray(newClient) ? newClient[0] : newClient;
    if(clientData) {
        setLocalClients([clientData, ...localClients]);
        const isWholesale = clientData.es_mayorista || false;
        setSelectedClient({ 
            nombre: clientData.nombre || clientData.razonSocial || clientData.full_name, 
            identificacion: findClientId(clientData), 
            telefono: clientData.telefono || clientData.celular || '', 
            direccion: clientData.direccion || '', 
            email: clientData.email || clientData.correo || '' 
        });
        setClientSearch(clientData.nombre || clientData.razonSocial || clientData.full_name);
        setShowNewClientModal(false);

        setEsMayorista(isWholesale);
        setProducts(prev => recalculatePrices(prev, isWholesale));

        if(onReloadClients) onReloadClients();
    }
  };

  const handleNewClient = () => { 
      if (onCreateClient) onCreateClient(); 
      else setShowNewClientModal(true);
  };

  const handleCatalogSelect = (item) => {
    const minQty = item.venta_minima !== undefined && item.venta_minima !== null ? parseInt(item.venta_minima, 10) : 1;
    
    let computedPrice = 0;
    if (!item.es_por_metro) {
        computedPrice = getPriceForQty(minQty, item, esMayorista);
    }

    let finalDesc = item.nombre;
    if (item.descripcion) finalDesc += ` - ${item.descripcion}`;

    // 🔧 NUEVO: precio mínimo editable, precargado con el del catálogo
    const minCatalogoItem = Number(item.precio_minimo) > 0 ? Number(item.precio_minimo) : getPriceForQty(1, item, esMayorista);

    setProducts(prev => {
        const newProducts = [...prev];
        const emptyIndex = newProducts.findIndex(p => !p.descripcion || p.descripcion.trim() === '');

        const newProduct = {
            cantidad: minQty > 0 ? minQty : 1, 
            venta_minima: minQty > 0 ? minQty : 1,
            base: '', altura: '',
            descripcion: finalDesc,
            observaciones: item.observaciones || '', 
            precioUnitario: computedPrice || '', 
            precioBaseOriginal: Number(item.precio) || 0,
            precios_escalonados: item.precios_escalonados || [],
            precioDistribuidorBase: Number(item.precio_distribuidor) || 0,
            precios_distribuidor: item.precios_distribuidor || [],
            es_por_metro: item.es_por_metro || false,
            precio_minimo: Number(item.precio_minimo) || 0,
            precioMinimoManual: item.es_por_metro ? minCatalogoItem : '',
            total: item.es_por_metro ? 0 : parseFloat((computedPrice * (minQty > 0 ? minQty : 1)).toFixed(2))
        };

        if (emptyIndex !== -1) { 
            newProducts[emptyIndex] = newProduct; 
            if (emptyIndex === newProducts.length - 1) newProducts.push({ cantidad: 1, descripcion: '', observaciones: '', precioUnitario: 0, total: 0, base: '', altura: '', venta_minima: 1, es_por_metro: false, precio_minimo: 0, precioMinimoManual: '' }); 
        } 
        else { 
            newProducts.push(newProduct); 
            newProducts.push({ cantidad: 1, descripcion: '', observaciones: '', precioUnitario: 0, total: 0, base: '', altura: '', venta_minima: 1, es_por_metro: false, precio_minimo: 0, precioMinimoManual: '' }); 
        }
        return newProducts;
    });
    setIsCatalogOpen(false); toast({ title: "Añadido", description: `${item.nombre} agregado a la proforma.` });
  };

  const handleProductSearchRequest = async (index, value) => {
      updateProduct(index, 'descripcion', value);
      if (value.trim().length < 2) { setProductSuggestions([]); setActiveProductSearchRow(null); return; }
      setActiveProductSearchRow(index);
      
      const terms = value.trim().split(/\s+/);
      let query = supabase.from('catalogo_productos').select('*');
      terms.forEach(term => { query = query.or(`nombre.ilike.%${term}%,categoria.ilike.%${term}%,codigo.ilike.%${term}%`); });
      const { data } = await query.limit(12);
      
      setProductSuggestions(data || []);
  };

  const handleSelectProductSuggestion = (index, product) => {
      const minQty = product.venta_minima !== undefined && product.venta_minima !== null ? parseInt(product.venta_minima, 10) : 1;
      
      let computedPrice = 0;
      if (!product.es_por_metro) {
          computedPrice = getPriceForQty(minQty, product, esMayorista);
      }

      let finalDesc = product.nombre;
      if (product.descripcion) finalDesc += ` - ${product.descripcion}`;

      // 🔧 NUEVO: precio mínimo editable, precargado con el del catálogo
      const minCatalogoProduct = Number(product.precio_minimo) > 0 ? Number(product.precio_minimo) : getPriceForQty(minQty, product, esMayorista);

      setProducts(prev => {
          const newProducts = [...prev];
          newProducts[index] = { 
              ...newProducts[index], descripcion: finalDesc, 
              observaciones: product.observaciones || '', 
              precioUnitario: computedPrice || '', 
              precioBaseOriginal: Number(product.precio) || 0,
              precios_escalonados: product.precios_escalonados || [],
              precioDistribuidorBase: Number(product.precio_distribuidor) || 0,
              precios_distribuidor: product.precios_distribuidor || [],
              venta_minima: minQty > 0 ? minQty : 1, 
              cantidad: minQty > 0 ? minQty : 1, 
              base: '', altura: '', es_por_metro: product.es_por_metro || false,
              precio_minimo: Number(product.precio_minimo) || 0,
              precioMinimoManual: product.es_por_metro ? minCatalogoProduct : '',
              total: product.es_por_metro ? 0 : parseFloat(((minQty > 0 ? minQty : 1) * computedPrice).toFixed(2))
          };
          if (index === newProducts.length - 1) newProducts.push({ cantidad: 1, descripcion: '', observaciones: '', precioUnitario: 0, total: 0, base: '', altura: '', venta_minima: 1, es_por_metro: false, precio_minimo: 0, precioMinimoManual: '' });
          return newProducts;
      });
      setProductSuggestions([]); setActiveProductSearchRow(null);
  };

  const updateProduct = (index, field, value) => {
    setProducts(prev => {
        const newProducts = [...prev];
        let item = { ...newProducts[index], [field]: value };
        
        const q = parseFloat(item.cantidad) || 0; 
        const b = parseFloat(item.base) || 0; 
        const a = parseFloat(item.altura) || 0; 
        // 🔧 NUEVO: si el usuario editó el precio mínimo manualmente, ese manda;
        // si no, usamos el mínimo del catálogo (precio_minimo) o el precio base.
        const minCatalogo = Number(item.precio_minimo) > 0 ? Number(item.precio_minimo) : getPriceForQty(1, item, esMayorista);
        const PRECIO_MINIMO_ITEM = item.precioMinimoManual !== undefined && item.precioMinimoManual !== '' 
            ? parseFloat(item.precioMinimoManual) : minCatalogo;

        if (item.es_por_metro) {
            // 🔧 NUEVO: si el usuario está editando el Total directamente, se
            // respeta ese valor tal cual — antes siempre se recalculaba
            // automáticamente, así que no había forma de escribir un total
            // manual para productos por m².
            if (field === 'total') {
                item.total = parseFloat(value) || 0;
            } else {
                const areaIndividual = (b / 100) * (a / 100); 
                const areaTotal = parseFloat((areaIndividual * q).toFixed(2));
                
                if (['base', 'altura', 'cantidad', 'precioMinimoManual'].includes(field) && item.precioBaseOriginal !== undefined) {
                    if (areaTotal > 0) {
                        item.precioUnitario = getPriceForQty(areaTotal, item, esMayorista);
                    } else {
                        item.precioUnitario = '';
                    }
                }

                const pUnit = parseFloat(item.precioUnitario) || 0;
                let precioPorPieza = areaIndividual * pUnit;

                if (areaIndividual > 0 && precioPorPieza < PRECIO_MINIMO_ITEM) {
                    precioPorPieza = PRECIO_MINIMO_ITEM;
                }

                let calcTotal = precioPorPieza * q;
                if (calcTotal > 0) calcTotal = roundUpToHalf(calcTotal);
                item.total = calcTotal;
            }

        } else {
            if (field === 'cantidad' && item.precioBaseOriginal !== undefined) {
                item.precioUnitario = getPriceForQty(q, item, esMayorista);
            }
            const price = parseFloat(item.precioUnitario) || 0;
            item.total = parseFloat((q * price).toFixed(2));
        }

        if (field === 'precioUnitario' && !item.es_por_metro) {
            const price = parseFloat(value) || 0;
            item.total = parseFloat((q * price).toFixed(2));
        } else if (field === 'precioUnitario' && item.es_por_metro) {
            const price = parseFloat(value) || 0;
            const areaIndividual = (b / 100) * (a / 100);
            let precioPorPieza = areaIndividual * price;
            if (areaIndividual > 0 && precioPorPieza < PRECIO_MINIMO_ITEM) {
                precioPorPieza = PRECIO_MINIMO_ITEM;
            }
            let calcTotal = precioPorPieza * q;
            if (calcTotal > 0) calcTotal = roundUpToHalf(calcTotal);
            item.total = calcTotal;
        }

        if (field === 'descripcion' && index === newProducts.length - 1 && value !== '') {
            newProducts.push({ cantidad: 1, descripcion: '', observaciones: '', precioUnitario: 0, total: 0, base: '', altura: '', venta_minima: 1, es_por_metro: false, precio_minimo: 0, precioMinimoManual: '' });
        }
        
        newProducts[index] = item; return newProducts;
    });
  };

  const handleQuantityBlur = (index, value) => {
      const item = products[index]; if (!item.descripcion) return;
      const min = item.venta_minima !== undefined && item.venta_minima !== null ? parseInt(item.venta_minima, 10) : 1;
      let qty = parseInt(value, 10);
      if (isNaN(qty)) qty = 0;

      if (qty > 0 && min > 0 && qty < min) { 
          toast({ title: "Venta Mínima", description: `Este producto exige mínimo ${min} unidades.`, variant: "destructive" }); 
          updateProduct(index, 'cantidad', min); 
      } else {
          updateProduct(index, 'cantidad', qty);
      }
  };

  const addProduct = () => setProducts(prev => [...prev, { cantidad: 1, descripcion: '', observaciones: '', precioUnitario: 0, total: 0, base: '', altura: '', venta_minima: 1, es_por_metro: false, precio_minimo: 0, precioMinimoManual: '' }]);
  const removeProduct = (idx) => setProducts(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const handleSubmit = async () => {
    const finalName = selectedClient.nombre || clientSearch;
    if (!finalName) { toast({ title: "Falta Cliente", description: "Ingrese el nombre del cliente.", variant: "destructive" }); return; }
    if (!titulo.trim()) { toast({ title: "Falta Título", description: "Por favor, agregue un título o referencia a la cotización.", variant: "destructive" }); return; }
    
    const validProducts = products.filter(p => p.descripcion && p.descripcion.trim() !== '');
    if (validProducts.length === 0) { toast({ title: "Sin productos", description: "Añada al menos un producto a la cotización.", variant: "destructive" }); return; }

    const invalidMetroProducts = validProducts.filter(p => p.es_por_metro && (p.base === '' || p.altura === ''));
    if (invalidMetroProducts.length > 0) {
      toast({ title: "Medidas Requeridas", description: "Debe colocar Ancho y Alto en centímetros para los productos por metro.", variant: "destructive" });
      setLoading(false); return;
    }

    setLoading(true);

    const processedProducts = validProducts.map(p => {
        if (p.es_por_metro && p.base && p.altura) {
            let cleanDesc = p.descripcion.replace(/\(\s*\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*cm\s*\)/g, '').trim();
            const medidaString = `(${p.base}x${p.altura}cm)`;
            return { ...p, descripcion: `${cleanDesc} ${medidaString}` };
        }
        return p;
    });

    try {
      // 🔧 FIX: subir las imágenes nuevas (con .blob) a Storage antes de guardar,
      // y dejar solo {name, url} en el payload — nunca el Blob crudo (no es JSON
      // válido y es lo que estaba rompiendo el guardado silenciosamente).
      const folderId = initialData?.id || `temp-${Date.now()}`;
      const imagenesFinal = await Promise.all(
          imagenes.map(async (img) => {
              if (img.blob) {
                  return await uploadProformaImage(folderId, img);
              }
              return { name: img.name, url: img.url };
          })
      );

      const payload = {
        titulo: titulo, cliente_nombre: finalName, cliente_identificacion: selectedClient.identificacion, cliente_telefono: selectedClient.telefono,
        cliente_direccion: selectedClient.direccion, cliente_email: selectedClient.email, 
        items: processedProducts, 
        subtotal: financials.subtotal, iva: financials.iva, total: financials.total, iva_percentage: applyIva ? ivaPercentage : 0, dias_entrega: Number(diasEntrega) || 0,
        financials: { 
            subtotal: financials.subtotal, iva: financials.iva, total: financials.total, ivaPercentage: applyIva ? ivaPercentage : 0, diasEntrega: Number(diasEntrega) || 0,
            descuento: financials.descuento, descuentoMonto: financials.descuentoMonto, 
            anticipoPorc: financials.anticipoPorc, anticipoValor: financials.anticipoValor, saldoPorc: financials.saldoPorc, saldoValor: financials.saldoValor
        },
        aplicarIva: applyIva, preciosIncluyenIva: preciosIncluyenIva, // 🔧 SINCRONIZADO CON ORDERFORM
        notas: notes, responsable_nombre: responsable, status: initialData ? initialData.status : 'BORRADOR', updated_at: new Date().toISOString(),
        imagenes: imagenesFinal
      };

      if (!initialData) { payload.created_at = new Date().toISOString(); payload.creado_por = user.id; }

      // 🔧 FIX: antes no se revisaba el error de Supabase, así que aunque el guardado
      // fallara, siempre mostraba "✅ Guardado" — por eso la proforma "desaparecía".
      let saveError;
      if (initialData) {
          ({ error: saveError } = await supabase.from('proformas').update(payload).eq('id', initialData.id));
      } else {
          ({ error: saveError } = await supabase.from('proformas').insert([payload]));
      }
      if (saveError) throw saveError;

      toast({ title: "✅ Guardado", description: "Proforma registrada con éxito." }); onSuccess();
    } catch (error) { toast({ title: "Error", description: error.message || "No se pudo guardar", variant: "destructive" }); } 
    finally { setLoading(false); }
  };

  const getDisplayedProformaNumber = () => { if (initialData && (initialData.numero || initialData.proformaNumber)) { return String(initialData.numero || initialData.proformaNumber).padStart(6, '0'); } return 'Automático'; };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileText className="h-6 w-6 text-blue-600" />{initialData ? 'Editar Proforma' : 'Nueva Cotización'}</h2><p className="text-sm text-slate-500">{initialData ? `Editando #${getDisplayedProformaNumber()}` : `Consecutivo #${getDisplayedProformaNumber()}`}</p></div>
        <Button variant="ghost" onClick={onCancel} className="hover:bg-slate-100 rounded-full h-10 w-10 p-0"><X className="h-6 w-6 text-slate-500" /></Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4 border-b pb-2"><div className="flex items-center gap-2 text-blue-700 font-semibold"><User className="h-5 w-5" /> Datos Generales</div></div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-1"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Título / Referencia del Trabajo <span className="text-red-500">*</span></label><Input placeholder="Ej: Letrero luminoso..." value={titulo} onChange={(e) => setTitulo(e.target.value)} className="font-semibold text-blue-800" /></div>
                <div className="md:col-span-1"><label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Clock className="h-3 w-3 text-orange-500"/> Días Laborables para Entrega</label><Input type="number" min="0" placeholder="Ej: 5" value={diasEntrega} onChange={(e) => setDiasEntrega(e.target.value)} className="font-semibold text-orange-700 bg-orange-50/50 border-orange-200" /></div>
                
                <div className="relative md:col-span-2 flex gap-2 items-end">
                  <div className="relative flex-1">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Buscar Cliente</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input placeholder="Buscar por Nombre o RUC..." className="pl-9" value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setSelectedClient(prev => ({...prev, nombre: e.target.value})); setShowClientSuggestions(true); }} onFocus={() => setShowClientSuggestions(true)} onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)} />
                    </div>
                    {showClientSuggestions && clientSearch.length > 1 && filteredClients.length > 0 && (
                      <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-md shadow-xl mt-1 max-h-60 overflow-y-auto">
                        {filteredClients.map(client => { const displayId = findClientId(client) || 'S/N'; return ( <div key={client.id} className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm border-b border-slate-100 last:border-0" onMouseDown={(e) => { e.preventDefault(); handleClientSelect(client); }}><div className="font-bold text-slate-800">{client.nombre || client.razonSocial || client.full_name}</div><div className="text-xs text-slate-500">ID: {displayId}</div></div> ); })}
                      </div>
                    )}
                  </div>
                  <Button onClick={handleNewClient} className="bg-green-600 hover:bg-green-700 text-white min-w-[140px] mb-[1px]" type="button"><UserPlus className="h-4 w-4 mr-2" /> Nuevo Cliente</Button>
                </div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">RUC / ID</label><Input value={selectedClient.identificacion} onChange={(e) => setSelectedClient({...selectedClient, identificacion: e.target.value})} placeholder="099..." /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Teléfono</label><Input value={selectedClient.telefono} onChange={(e) => setSelectedClient({...selectedClient, telefono: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Mail className="h-3 w-3" /> Email</label><Input value={selectedClient.email} onChange={(e) => setSelectedClient({...selectedClient, email: e.target.value})} placeholder="correo@ejemplo.com" /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dirección</label><Input value={selectedClient.direccion} onChange={(e) => setSelectedClient({...selectedClient, direccion: e.target.value})} /></div>
                
                <div className="col-span-2">
                   <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Responsable:</label>
                   {isAdmin ? (
                      <select className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
                         <option value="">Seleccionar...</option>
                         {validSellers.map(u => (<option key={u.id} value={u.name}>{formatResponsableName(u)}</option>))}
                      </select>
                   ) : (<Input value={responsable} readOnly className="bg-slate-100" />)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                 <div className="flex items-center gap-2 text-blue-700 font-semibold"><Calculator className="h-5 w-5" /> Items a Cotizar</div>
                 <div className="flex gap-2 items-center">
                    {esMayorista && <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-1 rounded shadow-sm border border-indigo-200">TARIFA MAYORISTA APLICADA</span>}
                    <Button size="sm" type="button" onClick={() => setIsCatalogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2"><ShoppingCart className="h-4 w-4"/> Catálogo</Button>
                    <Button size="sm" type="button" onClick={addProduct} variant="outline" className="border-green-500 text-green-700 hover:bg-green-50"><Plus className="h-4 w-4 mr-1" /> Item Manual</Button>
                 </div>
              </div>
              <div className="overflow-visible border rounded-lg pb-10 bg-white"> 
                <table className="w-full text-sm">
                   <thead className="bg-slate-100 text-slate-600 font-semibold">
                      <tr><th className="px-3 py-2 text-left">Descripción</th><th className="px-3 py-2 text-center w-24">Cant.</th><th className="px-3 py-2 text-right w-32">P. Unit</th><th className="px-3 py-2 text-right w-32">Total</th><th className="px-3 py-2 w-10"></th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 bg-white">
                      {products.map((row, idx) => {
                        // 🔧 FIX: quitamos el .trim() de aquí — se aplicaba en CADA render mientras
                        // el usuario escribía, borrando el espacio recién tecleado al final del texto
                        // (por eso "no se podía dar espacio"). El trim final para guardar ya se hace
                        // aparte, al momento de guardar (más abajo en handleSave), así que esto es seguro.
                        const cleanDescription = (row.descripcion || '').replace(/\(\s*\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*cm\s*\)/g, '');

                        const b = parseFloat(row.base) || 0;
                        const a = parseFloat(row.altura) || 0;
                        const q = parseFloat(row.cantidad) || 0;
                        const pUnitario = parseFloat(row.precioUnitario) || 0;
                        
                        const areaIndividual = (b / 100) * (a / 100);
                        const areaTotalCalculada = areaIndividual * q;
                        const minCatalogoRow = Number(row.precio_minimo) > 0 ? Number(row.precio_minimo) : getPriceForQty(1, row, esMayorista);
                        const precioMinimoCatalogo = row.precioMinimoManual !== undefined && row.precioMinimoManual !== ''
                            ? parseFloat(row.precioMinimoManual) : minCatalogoRow;
                        const precioPorPieza = areaIndividual * pUnitario;
                        
                        const aplicaMinimo = row.es_por_metro && areaIndividual > 0 && precioPorPieza > 0 && precioPorPieza < precioMinimoCatalogo;

                        return (
                        <tr key={idx} className="hover:bg-slate-50 group">
                           <td className="p-2 relative align-top pt-3">
                              {(() => {
                                  // 🔧 FIX: se quita "esUltimaFila" — forzaba edición completa en el
                                  // último ítem aunque ya estuviera lleno; "!cleanDescription" ya
                                  // cubre el caso real de fila vacía lista para agregar un producto.
                                  const enEdicion = editingProductRow === idx || !cleanDescription;
                                  if (!enEdicion) {
                                      const { nombre, detalle } = getDescPartsForm(cleanDescription);
                                      return (
                                          <div
                                              className="w-full border border-slate-200 rounded p-2 text-sm cursor-text hover:border-blue-300 bg-white min-h-[60px]"
                                              onClick={() => setEditingProductRow(idx)}
                                              title="Clic para editar"
                                          >
                                              <div className="font-bold text-slate-800 uppercase">{nombre}</div>
                                              {detalle && (
                                                  <div className="mt-1.5 bg-slate-50 border border-slate-200 rounded p-2 text-[11px] text-slate-600 select-none">
                                                      <span className="font-bold text-slate-400 block text-[9px] uppercase">Descripción:</span>
                                                      <p className="whitespace-pre-wrap normal-case">{detalle}</p>
                                                  </div>
                                              )}
                                          </div>
                                      );
                                  }
                                  return (
                                      <textarea 
                                          autoFocus={editingProductRow === idx}
                                          className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:border-blue-500 resize-y min-h-[60px]" 
                                          placeholder={idx === products.length - 1 ? "Buscar catálogo o añadir manual..." : ""} 
                                          value={cleanDescription} 
                                          onChange={(e) => handleProductSearchRequest(idx, e.target.value)}
                                          onFocus={() => { if(cleanDescription && cleanDescription.length >= 2) handleProductSearchRequest(idx, cleanDescription); }}
                                          onBlur={() => setTimeout(() => { setActiveProductSearchRow(null); setEditingProductRow(null); }, 350)}
                                      />
                                  );
                              })()}
                              {row.observaciones && (
                                  <div className="text-[10px] text-slate-500 italic mt-1 leading-tight">
                                      {row.observaciones}
                                  </div>
                              )}

                              {row.es_por_metro && (
                                  <div className="flex flex-wrap items-center gap-2 mt-2 bg-purple-50 p-2 rounded-md border border-purple-200">
                                      <span className="text-xs font-bold text-purple-700">Medidas (cm):</span>
                                      <div className="flex items-center gap-1">
                                          <Input 
                                              type="number" step="1" min="0" placeholder="Ancho" 
                                              className="h-7 w-16 text-xs text-center px-1 py-0" 
                                              value={row.base !== undefined ? row.base : ''} 
                                              onChange={e => updateProduct(idx, 'base', e.target.value)} 
                                          />
                                          <span className="text-xs text-purple-500 font-bold">x</span>
                                          <Input 
                                              type="number" step="1" min="0" placeholder="Alto" 
                                              className="h-7 w-16 text-xs text-center px-1 py-0" 
                                              value={row.altura !== undefined ? row.altura : ''} 
                                              onChange={e => updateProduct(idx, 'altura', e.target.value)} 
                                          />
                                      </div>
                                      <span className="text-[10px] font-black text-purple-800 ml-2">
                                          = {areaIndividual.toFixed(2)} m² c/u
                                      </span>
                                      <span className="text-[10px] font-black text-indigo-800 ml-2 pl-2 border-l border-purple-300">
                                          Total: {areaTotalCalculada.toFixed(2)} m²
                                      </span>

                                      {/* 🔧 NUEVO: precio mínimo EDITABLE (a diferencia de Orden, aquí sí se puede cambiar) */}
                                      <div className="flex items-center gap-1 ml-2 pl-2 border-l border-purple-300">
                                          <span className="text-[10px] font-bold text-purple-700">P. Mín: $</span>
                                          <Input
                                              type="number" step="0.01" min="0"
                                              className="h-6 w-16 text-xs text-center px-1 py-0 border-purple-300 font-bold text-purple-900"
                                              value={row.precioMinimoManual !== undefined ? row.precioMinimoManual : ''}
                                              onChange={e => updateProduct(idx, 'precioMinimoManual', e.target.value)}
                                          />
                                      </div>
                                      
                                      {aplicaMinimo && (
                                          <span className="text-[9px] font-bold text-red-600 ml-2 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">
                                              Mín. Aplicado (${precioMinimoCatalogo.toFixed(2)})
                                          </span>
                                      )}
                                  </div>
                              )}

                              {activeProductSearchRow === idx && productSuggestions.length > 0 && (
                                  <div className="absolute z-50 w-full min-w-[300px] mt-1 bg-white border border-slate-300 rounded shadow-2xl max-h-60 overflow-y-auto left-0">
                                      {productSuggestions.map(prod => (
                                          <div key={prod.id} className="px-3 py-2 hover:bg-purple-50 cursor-pointer text-sm border-b border-slate-100" onMouseDown={(e) => { e.preventDefault(); handleSelectProductSuggestion(idx, prod); }}>
                                              <div className="font-bold text-slate-800">{prod.nombre}</div>
                                              <div className="flex justify-between items-center mt-1"><span className="text-[10px] text-slate-500 font-mono">{prod.codigo || ''}</span><span className="text-xs text-green-600 font-bold">${Number(prod.precio).toFixed(2)}</span></div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                           </td>
                           <td className="p-2 relative align-top pt-3">
                               <Input 
                                  type="number" 
                                  step="1" 
                                  className="w-full text-center border-none bg-transparent focus:ring-0 text-sm p-0 font-bold h-9" 
                                  min="1" 
                                  value={row.cantidad !== undefined ? row.cantidad : ''} 
                                  onChange={(e) => updateProduct(idx, 'cantidad', e.target.value)} 
                                  onKeyDown={e => {
                                      if (!row.es_por_metro && (e.key === '.' || e.key === ',')) e.preventDefault();
                                  }}
                                  onBlur={(e) => handleQuantityBlur(idx, e.target.value)} 
                               />
                               {row.es_por_metro && <span className="absolute bottom-[-2px] left-0 w-full text-center text-[9px] text-purple-600 font-bold leading-tight">Piezas</span>}
                           </td>
                           <td className="p-2 align-top pt-4">
                               <input 
                                   type="number" step="0.01" 
                                   className="w-full text-right border-none bg-transparent focus:ring-0 text-sm p-0 text-green-700 font-bold h-9" 
                                   value={row.precioUnitario !== undefined ? row.precioUnitario : ''} 
                                   onChange={e => updateProduct(idx, 'precioUnitario', e.target.value)} 
                               />
                           </td>
                           <td className="p-2 text-right font-bold text-slate-800 align-top pt-4">
                               {row.es_por_metro ? (
                                   <div className="flex items-center justify-end gap-0.5">
                                       <span className="text-xs">$</span>
                                       <input
                                           type="number" step="0.01"
                                           className="w-20 text-right border-none bg-transparent focus:ring-0 text-sm p-0 font-bold h-9"
                                           value={row.total !== undefined ? row.total : ''}
                                           onChange={e => updateProduct(idx, 'total', e.target.value)}
                                       />
                                   </div>
                               ) : (
                                   <>$ {Number(row.total || 0).toFixed(2)}</>
                               )}
                           </td>
                           <td className="p-2 text-center align-top pt-4">
                               {(row.nombre || row.descripcion) && (
                                   <button type="button" onClick={() => removeProduct(idx)} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity">
                                       <Trash2 className="h-4 w-4" />
                                   </button>
                               )}
                           </td>
                        </tr>
                      )})}
                   </tbody>
                   <tfoot className="bg-slate-50 text-xs font-medium text-slate-700 border-t border-slate-300">
                      <tr>
                         <td colSpan="3" className="text-right py-1 px-2">SubTotal</td>
                         <td className="text-right py-1 px-2">$ {financials.subtotal.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr>
                         <td colSpan="3" className="text-right py-1 px-2 flex items-center justify-end gap-2">
                            <span>Descuento</span>
                            <div className="flex items-center border border-slate-300 rounded bg-white overflow-hidden">
                               <span className="text-xs px-2 py-0.5 border-r border-slate-200 outline-none bg-slate-100">$</span>
                               <input 
                                 type="number" step="0.01"
                                 className="w-16 text-right px-1 py-0.5 outline-none text-xs"
                                 value={localDiscountVal}
                                 onChange={e => {
                                     setLocalDiscountVal(e.target.value);
                                     setFinancials(prev => ({...prev, descuentoMonto: parseFloat(e.target.value) || 0}));
                                 }}
                               />
                            </div>
                         </td>
                         <td className="text-right py-1 px-2 text-red-500">- $ {financials.descuento.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr>
                         <td colSpan="3" className="text-right py-1 px-2 flex items-center justify-end gap-2">
                             <span>IVA (%)</span>
                             <input 
                               type="number" step="0.01"
                               className="w-12 text-right border border-slate-300 rounded px-1 text-xs"
                               value={ivaPercentage}
                               onChange={e => setIvaPercentage(parseFloat(e.target.value) || 0)}
                             />
                         </td>
                         <td className="text-right py-1 px-2">$ {financials.iva.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300">
                         <td colSpan="3" className="text-right py-2 px-2">TOTAL</td>
                         <td className="text-right py-2 px-2">$ {financials.total.toFixed(2)}</td>
                         <td></td>
                      </tr>
                   </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 🔥 SECCIÓN: IMÁGENES DE REFERENCIA 🔥 */}
          <div className="space-y-3 pt-2">
             <label className="text-xs font-bold text-slate-700 block mb-1">Imágenes de Referencia / Artes (Opcional):</label>
             <div className="flex flex-wrap gap-4 items-start bg-white border border-slate-200 rounded-lg p-4">
                 {imagenes.map((img, i) => (
                     <div key={i} className="relative w-24 h-24 border border-slate-300 rounded overflow-hidden group shadow-sm">
                         <img src={img.previewUrl || img.url} className="w-full h-full object-cover" alt="Referencia" />
                         <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3"/></button>
                     </div>
                 ))}
                 
                 {isLoadingImages ? (
                     <div className="w-24 h-24 flex items-center justify-center border-2 border-dashed border-blue-300 bg-blue-50 text-blue-600 rounded"><Loader2 className="w-6 h-6 animate-spin" /></div>
                 ) : (
                     <label className="w-24 h-24 border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-slate-400 rounded flex flex-col items-center justify-center cursor-pointer transition-colors shadow-sm">
                         <input type="file" multiple accept="image/*" className="hidden" onChange={handleAddImages} />
                         <Plus className="h-6 w-6" />
                         <span className="text-[10px] font-bold mt-1 text-center leading-tight">Añadir<br/>Imágenes</span>
                     </label>
                 )}
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Condiciones / Notas Comerciales</label>
                <textarea className="w-full border border-slate-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none" placeholder="El cliente debe enviar el logo en curvas..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            
            <Card className="bg-slate-50 border-slate-200 h-fit">
              <CardContent className="p-5 space-y-3">
                <div className="flex justify-between text-sm text-slate-600"><span>Subtotal:</span><span className="font-medium">${financials.subtotal.toFixed(2)}</span></div>
                
                {/* 🔧 SINCRONIZADO CON ORDERFORM: checkbox de precios incluyen IVA */}
                {applyIva && (
                    <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-100 p-2 rounded">
                        <Checkbox
                            id="proforma-iva-incluido-check"
                            checked={preciosIncluyenIva}
                            onCheckedChange={(c) => setPreciosIncluyenIva(c)}
                        />
                        <label htmlFor="proforma-iva-incluido-check" className="cursor-pointer text-blue-700 font-bold">Precios incluyen IVA</label>
                    </div>
                )}

                <div className="flex justify-between items-center text-sm text-slate-600 bg-white p-2 rounded border border-slate-100 mt-2">
                  <div className="flex items-center gap-2"><Switch checked={applyIva} onCheckedChange={setApplyIva} className="scale-75 data-[state=checked]:bg-blue-600" /><span className={!applyIva ? 'text-slate-400 line-through' : 'font-medium'}>IVA ({ivaPercentage}%)</span></div>
                  <span className={`font-medium ${!applyIva ? 'text-slate-300' : ''}`}>${financials.iva.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-300 pt-3 flex justify-between items-center"><span className="font-bold text-lg text-slate-800">TOTAL:</span><span className="font-bold text-2xl text-blue-700">${financials.total.toFixed(2)}</span></div>
                
                <div className="border-t border-blue-200 mt-4 pt-3 space-y-2">
                    <span className="text-xs font-bold text-blue-800 uppercase block mb-2">Forma de Pago Requerida</span>
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center text-slate-600">Anticipo <input type="number" className="w-12 h-6 border rounded text-center ml-2 text-xs font-bold text-blue-700 bg-blue-50" value={financials.anticipoPorc} onChange={e => { let val = Number(e.target.value); if(val > 100) val = 100; if(val < 0) val = 0; setFinancials(prev => ({...prev, anticipoPorc: val})); }} />%</span>
                        <span className="font-bold text-slate-700">${financials.anticipoValor.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Saldo ({financials.saldoPorc}%)</span><span className="font-bold text-slate-700">${financials.saldoValor.toFixed(2)}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-slate-200 p-4 flex justify-end gap-3 sticky bottom-0 z-20">
        <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[160px]">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} {initialData ? 'Actualizar' : 'Guardar Cotización'}</Button>
      </div>

      {/* 🔥 MODAL LATERAL DE CATÁLOGO 🔥 */}
      {isCatalogOpen && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl z-[100] flex flex-col border-l border-slate-200 animate-in slide-in-from-right">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0"><h3 className="font-bold text-lg flex items-center gap-2"><ShoppingCart className="h-5 w-5"/> Catálogo de Precios</h3><Button variant="ghost" size="icon" onClick={() => setIsCatalogOpen(false)} className="hover:bg-slate-700"><X className="h-5 w-5" /></Button></div>
            <div className="p-4 border-b border-slate-200 shrink-0 bg-slate-50"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input autoFocus placeholder="Buscar por código, nombre o categoría..." className="pl-9 bg-white" value={searchCatalog} onChange={e => setSearchCatalog(e.target.value)} /></div></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                {catalogItems.filter(item => (item.nombre || '').toLowerCase().includes(searchCatalog.toLowerCase()) || (item.codigo || '').toLowerCase().includes(searchCatalog.toLowerCase()) || (item.categoria || '').toLowerCase().includes(searchCatalog.toLowerCase())).map(item => (
                    <div key={item.id} className="bg-slate-50 border border-slate-200 p-3 rounded-lg shadow-sm hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group" onClick={() => handleCatalogSelect(item)}>
                        <div className="flex justify-between items-start mb-1"><span className="font-bold text-sm text-slate-800 group-hover:text-blue-700 uppercase">{item.nombre}</span><span className="font-bold text-green-700">${Number(item.precio).toFixed(2)}</span></div>
                        <div className="text-[10px] font-bold text-purple-600 mb-1">{item.categoria}</div>
                        <div className="text-xs text-slate-500 line-clamp-2">{item.descripcion || item.observaciones}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            {item.es_por_metro && <span className="text-[10px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded">Precio Fijo/Rango</span>}
                            {item.venta_minima > 1 && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">Mínimo: {item.venta_minima}</span>}
                            {item.precios_escalonados && item.precios_escalonados.length > 0 && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Descuentos por volumen</span>}
                        </div>
                    </div>
                ))}
                {catalogItems.length === 0 && <div className="text-center py-10 text-slate-400">Catálogo vacío. Agrega productos en el módulo de Catálogo.</div>}
            </div>
        </div>
      )}
      
      {showNewClientModal && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200 p-4">
            <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold text-lg">Nuevo Cliente</h3><Button size="sm" variant="ghost" onClick={()=>setShowNewClientModal(false)}><X/></Button></div>
            <div className="flex-1 overflow-y-auto"><ClientForm user={user} onCancel={()=>setShowNewClientModal(false)} onSuccess={handleNewClientCreated} clienteAEditar={newClientInitialData} /></div>
        </div>
      )}
    </div>
  );
};

export default ProformaForm;