/**
 * ============================================================================
 * 🚀 ШПАРГАЛКА И РУКОВОДСТВО ПО АДАПТАЦИИ НОД ПОД COMFYUI NODES 2.0 (VUE MODE)
 * ============================================================================
 * 
 * Данное руководство собрано на основе реального боевого опыта разработки,
 * оптимизации и устранения сложнейших багов в супер-нодах (Trix NDSuper LoRA Loader,
 * Trix Bypasser Simple & Groups и др.).
 * 
 * Оно содержит проверенные архитектурные паттерны, готовые сниппеты кода,
 * формулы точного математического расчёта геометрии, решения проблем с ресайзом,
 * зумом, кликами, двойным хромом и исчезновением элементов.
 * 
 * ============================================================================
 * 📋 СОДЕРЖАНИЕ:
 * 1. В ЧЁМ РАЗНИЦА МЕЖДУ NODES 1.0 (LiteGraph) И NODES 2.0 (Vue)
 * 2. ТОП-7 БАГОВ И ГРАБЛЕЙ ПРИ ПЕРЕХОДЕ НА NODES 2.0
 * 3. УНИВЕРСАЛЬНАЯ DOM-АРХИТЕКТУРА (ЗОЛОТОЙ СТАНДАРТ)
 * 4. МЕТОД ОПРЕДЕЛЕНИЯ РЕЖИМА: isVueNodes()
 * 5. РЕШЕНИЕ ПРОБЛЕМЫ ИСЧЕЗНОВЕНИЯ ПРИ ЗУМЕ: applyAdaptiveCanvasOnly()
 * 6. ПРОБРОС ЗУМА КОЛЕСОМ МЫШИ: installCanvasZoomPassthrough()
 * 7. СВОБОДНЫЙ РЕСАЙЗ ЗА УГЛЫ И СТЯГИВАНИЕ ПО ШИРИНЕ: gateResizeAndDraw()
 * 8. РАСЧЁТ ВЫСОТЫ, БОРЬБА С ПУСТОТОЙ И АВТО-СТЯГИВАНИЕ (Auto-Shrink)
 * 9. ЦЕНТРАЛИЗОВАННОЕ ДЕЛЕГИРОВАНИЕ КЛИКОВ (data-act)
 * 10. АДАПТИВНЫЙ РЕСПОНСИВ (ResizeObserver + CSS data-mode)
 * 11. МАТЕМАТИЧЕСКИ ТОЧНЫЕ ИКОНКИ И ВЫРАВНИВАНИЕ ПО ЛИНЕЙКЕ
 * 12. МОДАЛЬНЫЕ ОКНА И ПОИСК НОД В ПОДГРАФАХ (Subgraphs)
 * 13. ПОЛНЫЙ ГОТОВЫЙ ШАБЛОН ДЛЯ БЫСТРОГО СТАРТА (Boilerplate)
 * ============================================================================
 */

// ============================================================================
// 1. В ЧЁМ РАЗНИЦА МЕЖДУ NODES 1.0 И NODES 2.0
// ============================================================================
/*
 * 🏛 Nodes 1.0 (Classic Canvas / LiteGraph):
 *   - Вся сцена рисуется на одном гигантском элементе <canvas> через 2D-контекст LiteGraph.
 *   - DOM-виджеты абсолютно позиционируются поверх канваса через `style.left` и `style.top`.
 *   - Высота ноды (`node.size[1]`) ДОЛЖНА включать высоту заголовка (title bar, обычно 28px)
 *     плюс высоту контента виджета.
 *
 * 🌐 Nodes 2.0 (Vue Mode):
 *   - Каждая нода рендерится как независимый HTML/DOM Vue-компонент.
 *   - Vue сам оборачивает ноду в свою карточку и САМ добавляет свой заголовок сверху.
 *   - DOM-виджет монтируется внутрь тела ноды с `width: 100%`.
 *   - Высота виджета передается через `computeLayoutSize.minHeight = contentH`.
 *   - Если передать в `node.setSize` значение с запасом под заголовок (`contentH + 34`),
 *     Vue добавит СВОЙ заголовок СВЕРХУ этого, и внизу образуется огромная пустота (Double-Chrome Bug)!
 */


// ============================================================================
// 2. ТОП-7 БАГОВ И ГРАБЛЕЙ ПРИ ПЕРЕХОДЕ НА NODES 2.0
// ============================================================================
/*
 * ❌ Баг 1: «Бесконечный рост ноды» (Runaway Height Growth).
 *    Причина: Чтение `element.scrollHeight` или `offsetHeight` внутри `calculateHeight`.
 *    При увеличении размера ноды контейнер растет -> scrollHeight растет -> setSize растет ->
 *    нода бесконечно ползет вниз каждый кадр.
 *    Решение: 100% чистая детерминированная математика на основе данных (properties).
 *
 * ❌ Баг 2: «Лишняя пустота снизу» (Double-Chrome Void Bug).
 *    Причина: Добавление отступа под заголовок (28-34px) в `node.setSize` в режиме Vue.
 *    Решение: В Vue режиме передавать в `node.setSize([w, contentH])` только ЧИСТУЮ высоту контента!
 *
 * ❌ Баг 3: «Нода не стягивается обратно» (Non-Shrinking on Collapse/Delete).
 *    Причина: В `fitNode` стояла проверка `if (node.size[1] < reqH)`, которая умеет только расти,
 *    или в Vue режиме был полностью отключен `setSize`.
 *    Решение: Разделять вызовы на `isStructural = true` (добавление, удаление, сворачивание)
 *    и `isStructural = false` (обычный перерендер). При `isStructural = true` принудительно
 *    вызывать `node.setSize([curW, contentH])`, возвращая ноду к минимальной высоте.
 *
 * ❌ Баг 4: «Обрезание нижних кнопок/элементов» (Clipping Bug).
 *    Причина: Неверный расчёт геометрии CSS (забыли учесть padding-top, flex-gap, margin-bottom
 *    или отступ под кнопку добавления).
 *    Решение: Считать каждый пиксель по точной CSS-модели (см. Раздел 8).
 *
 * ❌ Баг 5: «Ноду невозможно стянуть обратно по ширине».
 *    Причина: `widget.computeSize` или `onResize` жестко фиксировали ширину `[Math.max(w, 340), ...]`.
 *    Решение: Использовать архитектуру `gateResizeAndDraw` с минимальным порогом 240px.
 *
 * ❌ Баг 6: «Исчезновение ноды при отдалении камеры» (Zoom Out Disappearing).
 *    Причина: LiteGraph по умолчанию имеет `canvasOnly = true`, и ComfyUI скрывает DOM при зуме.
 *    Решение: Динамический геттер `applyAdaptiveCanvasOnly(widget)` (`canvasOnly = false` в Vue).
 *
 * ❌ Баг 7: «Блокировка колесика мыши над нодой в Nodes 1.0».
 *    Причина: DOM-элемент перехватывает событие `wheel` и не пускает его к холсту.
 *    Решение: Функция `installCanvasZoomPassthrough(root)`.
 */


// ============================================================================
// 3. УНИВЕРСАЛЬНАЯ DOM-АРХИТЕКТУРА (ЗОЛОТОЙ СТАНДАРТ)
// ============================================================================
/*
 * Для 100% стабильной работы в ОБЕИХ версиях ComfyUI:
 * 
 * 1. Создается корневой DOM-контейнер (`div.trix-bp-root`).
 * 2. Монтируется через `node.addDOMWidget()`.
 * 3. Настраиваются `computeSize`, `computeLayoutSize` и `draw`.
 * 4. На класс ноды вешается хук `gateResizeAndDraw(nodeType, minW, minH)`.
 * 5. Вся разметка генерируется чистым методом `render(node, isStructural)`.
 * 6. Высота управляется методом `fitNode(node, isStructural)`.
 */


// ============================================================================
// 4. МЕТОД ОПРЕДЕЛЕНИЯ РЕЖИМА: isVueNodes()
// ============================================================================

export function isVueNodes() {
    return !!(
        window.LiteGraph?.vueNodesMode ||
        app.canvas?.vueNodesMode ||
        (typeof LGraphCanvas !== "undefined" && LGraphCanvas.vueNodesMode)
    );
}


// ============================================================================
// 5. РЕШЕНИЕ ПРОБЛЕМЫ ИСЧЕЗНОВЕНИЯ ПРИ ЗУМЕ: applyAdaptiveCanvasOnly()
// ============================================================================
/**
 * В LiteGraph classic canvasOnly=true оптимизирует скрытие,
 * но в Nodes 2.0 canvasOnly ДОЛЖЕН быть false, иначе нода пропадет при зуме.
 */
export function applyAdaptiveCanvasOnly(widget) {
    if (!widget || !widget.options) return widget;
    try {
        Object.defineProperty(widget.options, "canvasOnly", {
            configurable: true,
            enumerable: true,
            get() {
                return !isVueNodes(); // В Nodes 2.0 всегда false!
            },
        });
    } catch (_e) {
        widget.options.canvasOnly = !isVueNodes();
    }
    return widget;
}


// ============================================================================
// 6. ПРОБРОС ЗУМА КОЛЕСОМ МЫШИ: installCanvasZoomPassthrough()
// ============================================================================
/**
 * В Nodes 1.0 колесо мыши над DOM-элементом не зумирует холст.
 * Этот хук перенаправляет WheelEvent на нативный холст ComfyUI.
 */
export function installCanvasZoomPassthrough(root) {
    if (!root || typeof root.addEventListener !== "function") return () => {};

    const onWheel = (e) => {
        if (isVueNodes()) return; // В Nodes 2.0 Vue сам обрабатывает события
        if (e.ctrlKey || e.metaKey) return;

        const canvasEl = app?.canvas?.canvas;
        if (!canvasEl) return;

        e.preventDefault();
        e.stopPropagation();

        const { clientX, clientY, deltaX, deltaY, deltaMode, ctrlKey, metaKey, shiftKey } = e;
        canvasEl.dispatchEvent(new WheelEvent("wheel", {
            clientX, clientY, deltaX, deltaY, deltaMode,
            ctrlKey, metaKey, shiftKey, bubbles: true, cancelable: true
        }));
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
}


// ============================================================================
// 7. СВОБОДНЫЙ РЕСАЙЗ ПО ШИРИНЕ И 100% АВТО-СТЯГИВАНИЕ: gateResizeAndDraw()
// ============================================================================
/**
 * 💡 ВАЖНЕЙШИЕ ПРАВИЛА ДЛЯ СВОБОДНОГО ЗАХВАТА И РЕСАЙЗА НОДЫ:
 * 1. В `addDOMWidget` ВСЕГДА ставьте `margin: 4` (или `margin: 2`), а НЕ `margin: 0`!
 *    При `margin: 0` DOM-виджет перекрывает 4px рамку ноды `.lg-node`, и курсор мыши
 *    не может зацепить ручки изменения размера на нижних углах и гранях!
 * 2. У корневого элемента `.my-root` в CSS должно быть `pointer-events: none`,
 *    а у кнопок/строк — `pointer-events: auto`.
 * 3. Для динамических нод-списков:
 *    - `calculateRequiredNodeHeight(node)` возвращает `(root.offsetHeight > 0 ? root.offsetHeight : calculateHeight(node)) + 28`.
 *    - `fitNode(node)` вызывает `node.setSize([curW, reqH])`, обеспечивая мгновенное сжатие в обоих режимах (Nodes 1.0 и 2.0).
 *    - В `onResize` фиксируем `size[1] = reqMinH`, разрешая пользователю менять только ширину `size[0]`.
 *    - Никаких глобальных слушателей на `window` — чужие ноды никогда не будут вызывать вздрагиваний!
 */
export function gateResizeAndDraw(nodeType, minW = 240, minH = 60) {
    const origOnResize = nodeType.prototype.onResize;
    nodeType.prototype.onResize = function (size) {
        const domH = (this._trixDomRoot && this._trixDomRoot.offsetHeight > 0)
            ? this._trixDomRoot.offsetHeight
            : (MyDOMRenderer.calculateHeight ? MyDOMRenderer.calculateHeight(this) : (minH || 60));
        const reqMinH = domH + 28;
        const reqMinW = minW || 240;

        if (Array.isArray(size)) {
            if (size[0] < reqMinW) size[0] = reqMinW;
            size[1] = reqMinH;
        } else if (size && typeof size === "object") {
            if (typeof size[0] === "number") size[0] = Math.max(size[0], reqMinW);
            if (typeof size[1] === "number") size[1] = reqMinH;
            if (typeof size.x === "number") size.x = Math.max(size.x, reqMinW);
            if (typeof size.y === "number") size.y = reqMinH;
        }
        if (this.size && Array.isArray(this.size)) {
            if (this.size[0] < reqMinW) this.size[0] = reqMinW;
            this.size[1] = reqMinH;
        }
        if (origOnResize) return origOnResize.apply(this, arguments);
    };

    const origDraw = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function (ctx) {
        if (origDraw) origDraw.call(this, ctx);
        if (this.flags?.collapsed || isVueNodes()) return;
        if (this.size && Array.isArray(this.size)) {
            if (this.size[0] < minW) this.size[0] = minW;
        }
    };
}


// ============================================================================
// 8. РАСЧЁТ ВЫСОТЫ, БОРЬБА С ПУСТОТОЙ И АВТО-СТЯГИВАНИЕ (Auto-Shrink)
// ============================================================================
/*
 * 📐 ПРАВИЛО ТОЧНОГО РАСЧЁТА ГЕОМЕТРИИ (Exact CSS Geometry):
 * Никогда не угадывайте случайные числа. Считайте точно по CSS блокам:
 *
 * 1. Базовый контейнер (BASE_H):
 *    - root padding-top: 3px
 *    - header tray height: 27px
 *    - header margin-bottom + gap: 5px
 *    - root padding-bottom: 6px
 *    = ИТОГО BASE_H = 41px.
 *
 * 2. Обычная строка (Simple Row):
 *    - Высота строки: 22px
 *    - margin-bottom: 2px
 *    = 24px на каждый элемент.
 *
 * 3. Карточка группы (Group Card):
 *    - Свёрнутая группа: header(22px) + padding(6px) + border(2px) + margin(3px) = 33px.
 *    - Раскрытая группа с N строками:
 *      header(30px) + gap(2px) + строки(26px * N) + кнопка добавления(23px) + margin(3px)
 *      = 56 + 26px * N.
 *
 * 🌟 ЗОЛОТОЙ МЕТОД fitNode + ResizeObserver (АРХИТЕКТУРА TrixPromptAIO):
 *
 * 1. `calculateRequiredNodeHeight(node)`:
 *    - Считывает РЕАЛЬНУЮ высоту DOM из браузера: `root.offsetHeight > 0 ? root.offsetHeight : calculateHeight(node)`
 *    - Добавляет 28px шапки: `domH + 28`.
 * 2. `fitNode(node)`:
 *    - Вызывает `node.setSize([curW, reqH])` в обоих режимах (Nodes 1.0 и 2.0).
 * 3. `ResizeObserver` (главный секрет идеального схлопывания):
 *    - Отслеживает изменение высоты `root` в браузере в реальном времени.
 *    - При сворачивании групп, удалении или добавлении строк моментально схлопывает рамку ноды пиксель-в-пиксель!
 */

export class MyDOMRenderer {
    /**
     * Возвращает чистую высоту DOM-контента (детерминированная математика)
     */
    static calculateHeight(node) {
        if (!node?.properties?.myState) return 50;
        const state = node.properties.myState;

        const BASE_H = 41; // root pad top(3) + header(27) + gap(5) + pad bot(6)
        const items = state.items || [];
        
        return Math.max(50, BASE_H + items.length * 24);
    }

    /**
     * Полная высота ноды (dom widget + 28px шапка)
     */
    static calculateRequiredNodeHeight(node) {
        const domH = (node && node._myDomRoot && node._myDomRoot.offsetHeight > 0)
            ? node._myDomRoot.offsetHeight
            : this.calculateHeight(node);
        return domH + 28;
    }

    /**
     * 🎯 КЛЮЧЕВОЙ МЕТОД АВТО-ПОДГОНКИ РАЗМЕРА:
     */
    static fitNode(node, isStructural = false) {
        if (!node || node.flags?.collapsed) return;
        const requiredH = this.calculateRequiredNodeHeight(node);
        const currentW = Math.max(node.size?.[0] || 320, 240);

        if (node.setSize) {
            node.setSize([currentW, requiredH]);
        } else if (node.size) {
            node.size[0] = currentW;
            node.size[1] = requiredH;
        }
        if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
    }
}


// ============================================================================
// 9. ЦЕНТРАЛИЗОВАННОЕ ДЕЛЕГИРОВАНИЕ КЛИКОВ (data-act)
// ============================================================================
/*
 * Вместо сотен слушателей на каждой кнопке:
 * 1. В HTML элементах пишем: `data-act="addItem"`, `data-act="toggleActive"`.
 * 2. Вешаем ОДИН слушатель на корневой `root`.
 * 3. Индексы извлекаем безопасно:
 */
export function setupClickDelegation(root, node, actionHandler) {
    root.addEventListener("click", (e) => {
        const actEl = e.target.closest("[data-act]");
        if (!actEl) return;
        e.stopPropagation();

        const act = actEl.dataset.act;
        const itemEl = actEl.closest("[data-item-idx]");
        const groupEl = actEl.closest("[data-group-idx]");

        const itemIdx = actEl.dataset.itemIdx !== undefined
            ? parseInt(actEl.dataset.itemIdx)
            : (itemEl ? parseInt(itemEl.dataset.itemIdx) : null);
        const groupIdx = actEl.dataset.groupIdx !== undefined
            ? parseInt(actEl.dataset.groupIdx)
            : (groupEl ? parseInt(groupEl.dataset.groupIdx) : null);

        actionHandler(node, act, actEl, { itemIdx, groupIdx, event: e });
    });
}


// ============================================================================
// 10. АДАПТИВНЫЙ РЕСПОНСИВ (ResizeObserver + CSS data-mode)
// ============================================================================
/*
 * При сужении ноды по ширине не нужно перерисовывать DOM!
 * Достаточно отслеживать ширину через ResizeObserver и переключать CSS `data-mode`:
 * 
 * 1. Широкая (> 340px):   "full"  -> "Single", "Multi", "Add Target"
 * 2. Средняя (260-340px): "short" -> "Sngl", "Mult", "+ T"
 * 3. Узкая (< 260px):     "icon"  -> "⛂", "⛃", "+"
 */

export const RESPONSIVE_CSS = `
.my-root:not([data-mode]) .lbl-short,
.my-root:not([data-mode]) .lbl-icon,
.my-root[data-mode="full"] .lbl-short,
.my-root[data-mode="full"] .lbl-icon { display: none !important; }

.my-root[data-mode="short"] .lbl-full,
.my-root[data-mode="short"] .lbl-icon { display: none !important; }

.my-root[data-mode="icon"] .lbl-full,
.my-root[data-mode="icon"] .lbl-short { display: none !important; }
`;

export function setupResponsiveObserver(root, node) {
    const updateMode = (w) => {
        const newMode = w >= 340 ? "full" : (w >= 260 ? "short" : "icon");
        if (root.dataset.mode !== newMode) {
            root.dataset.mode = newMode;
        }
    };

    const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
            updateMode(entry.contentRect.width);
            const domH = root.offsetHeight > 0 ? root.offsetHeight : (root.scrollHeight > 0 ? root.scrollHeight : entry.contentRect.height);
            if (domH > 0 && node && !node.flags?.collapsed) {
                const targetH = Math.ceil(domH + 28);
                const curW = Math.max(node.size?.[0] || 320, 240);
                if (node.size && node.size[1] !== targetH) {
                    if (node.setSize) {
                        node.setSize([curW, targetH]);
                    } else if (node.size) {
                        node.size[0] = curW;
                        node.size[1] = targetH;
                    }
                    if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
                }
            }
        }
    });
    ro.observe(root);
    return ro;
}


// ============================================================================
// 11. МАТЕМАТИЧЕСКИ ТОЧНЫЕ ИКОНКИ И ВЫРАВНИВАНИЕ ПО ЛИНЕЙКЕ
// ============================================================================
/*
 * ⚠️ Текстовые символы (✕, 👁) плавают по высоте в разных браузерах и ОС.
 * ✅ Идеальное решение — микро-SVG с фиксированным viewBox:
 */

export const ICONS = {
    CROSS: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="pointer-events:none;display:block;"><path d="M2.2 2.2L7.8 7.8M7.8 2.2L2.2 7.8"/></svg>`,
    CROSS_SM: `<svg width="8.5" height="8.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="pointer-events:none;display:block;"><path d="M2.2 2.2L7.8 7.8M7.8 2.2L2.2 7.8"/></svg>`,
    EYE: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="pointer-events:none;display:block;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
};

/*
 * Изящный эффект Inset для вложенных карточек/групп:
 * Чтобы группы не выглядели тяжелыми и широкими, задайте им отступы по краям:
 *   .trix-bp-group-card {
 *       margin: 0 5px 3px 5px; // 5px слева и справа
 *       border-radius: 5px;
 *       padding: 3px 4px;
 *   }
 */


// ============================================================================
// 12. МОДАЛЬНЫЕ ОКНА И ПОИСК НОД В ПОДГРАФАХ (Subgraphs)
// ============================================================================
/*
 * В ComfyUI ноды могут быть упакованы в Subgraph (подграфы).
 * Обычный `app.graph.getNodeById()` их не видит!
 * Используйте рекурсивный поиск с поддержкой путей `subgraph_id:inner_id`:
 */
export function findNodeRecursively(graph, id) {
    if (!graph) return null;
    id = String(id).trim();

    if (id.includes(":")) {
        const parts = id.split(":");
        let currentGraph = app.graph;
        let node = null;
        for (const pid of parts) {
            if (!currentGraph) return null;
            node = currentGraph.getNodeById ? currentGraph.getNodeById(parseInt(pid)) : null;
            if (!node) {
                const nodes = currentGraph._nodes || currentGraph.nodes || [];
                node = nodes.find(n => String(n.id) === String(pid));
            }
            if (!node) return null;
            currentGraph = node.getInnerGraph ? node.getInnerGraph() : (node.innerGraph || node.subgraph || null);
        }
        return node;
    }

    const numericId = parseInt(id);
    if (!isNaN(numericId) && graph.getNodeById) {
        const n = graph.getNodeById(numericId);
        if (n) return n;
    }

    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
        if (String(n.id) === String(id)) return n;
        const inner = n.getInnerGraph ? n.getInnerGraph() : (n.innerGraph || n.subgraph || null);
        if (inner) {
            const found = findNodeRecursively(inner, id);
            if (found) return found;
        }
    }
    return null;
}


// ============================================================================
// 13. ПОЛНЫЙ ГОТОВЫЙ ШАБЛОН ДЛЯ БЫСТРОГО СТАРТА (Boilerplate)
// ============================================================================

export class MyUniversalNodeDOMRenderer {
    static mount(node) {
        if (node._myDomRoot) {
            this.render(node, true);
            return node._myDomWidget;
        }

        const root = document.createElement("div");
        root.className = "my-node-root";
        root.dataset.mode = "full";
        node._myDomRoot = root;

        // 1. Проброс зума для Nodes 1.0
        installCanvasZoomPassthrough(root);

        // 2. Респонсив наблюдатель + Авто-подгонка высоты (ResizeObserver)
        node._myResizeObs = setupResponsiveObserver(root, node);

        // 3. Делегирование кликов
        root.addEventListener("click", (e) => {
            const actEl = e.target.closest("[data-act]");
            if (!actEl) return;
            e.stopPropagation();
            const act = actEl.dataset.act;
            this.handleAction(node, act, actEl, e);
        });

        // 4. Регистрация DOM-виджета (margin: 4 обязателен для доступности рамки ресайза!)
        const widget = node.addDOMWidget("my_dom_ui", "my_dom_widget", root, {
            getValue: () => node.properties?.myState || null,
            setValue: () => {},
            getMinHeight: () => this.calculateHeight(node),
            margin: 4,
            serialize: false,
        });

        // 5. Размеры для LiteGraph и Vue
        applyAdaptiveCanvasOnly(widget);
        widget.computeSize = (w) => [w || 240, this.calculateHeight(node)];

        // 6. Позиционирование в LiteGraph Classic
        const origDraw = widget.draw;
        widget.draw = function(ctx, n, widget_width, y, H) {
            if (origDraw) origDraw.apply(this, arguments);
            if (this.element && !n.flags?.collapsed) {
                if (!isVueNodes()) {
                    const marginLeft = 3;
                    const marginRight = 3;
                    const topOffset = Math.max(y || 0, 28);
                    const curW = (n.size && n.size[0] > 0) ? n.size[0] : (widget_width || 320);
                    this.element.style.setProperty("left", (n.pos[0] + marginLeft) + "px", "important");
                    this.element.style.setProperty("top", (n.pos[1] + topOffset) + "px", "important");
                    this.element.style.setProperty("width", (curW - marginLeft - marginRight) + "px", "important");
                    this.element.style.setProperty("height", "auto", "important");
                    this.element.style.setProperty("margin", "0px", "important");
                    this.element.style.setProperty("box-sizing", "border-box", "important");
                } else {
                    this.element.style.removeProperty("left");
                    this.element.style.removeProperty("top");
                    this.element.style.setProperty("width", "100%", "important");
                    this.element.style.setProperty("box-sizing", "border-box", "important");
                    this.element.style.removeProperty("margin");
                }
            }
        };

        node._myDomWidget = widget;
        this.render(node, true);
        return widget;
    }

    static calculateHeight(node) {
        if (!node?.properties?.myState) return 50;
        const BASE_H = 41;
        const count = (node.properties.myState.items || []).length;
        return Math.max(50, BASE_H + count * 24);
    }

    static calculateRequiredNodeHeight(node) {
        const domH = (node && node._myDomRoot && node._myDomRoot.offsetHeight > 0)
            ? node._myDomRoot.offsetHeight
            : this.calculateHeight(node);
        return domH + 28;
    }

    static fitNode(node, isStructural = false) {
        if (!node) return;
        const requiredH = this.calculateRequiredNodeHeight(node);
        const curW = Math.max(node.size?.[0] || 320, 240);

        if (isStructural) {
            if (node.setSize) {
                node.setSize([curW, requiredH]);
            } else if (node.size) {
                node.size[0] = curW;
                node.size[1] = requiredH;
            }
            if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
        } else if (node.size && node.size[1] < requiredH) {
            if (node.setSize) {
                node.setSize([curW, requiredH]);
            } else if (node.size) {
                node.size[0] = curW;
                node.size[1] = requiredH;
            }
            if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
        }
    }

    static handleAction(node, act, actEl, e) {
        if (act === "add") {
            node.properties.myState.items.push({ text: "New Item" });
            this.render(node, true); // true = структурное изменение!
        } else if (act === "delete") {
            const idx = parseInt(actEl.dataset.idx);
            node.properties.myState.items.splice(idx, 1);
            this.render(node, true); // true = структурное изменение!
        }
    }

    static render(node, isStructural = false) {
        const root = node._myDomRoot;
        if (!root) return;

        const items = node.properties?.myState?.items || [];
        root.innerHTML = `
            <div class="my-header">
                <button data-act="add">+ Добавить</button>
            </div>
            <div class="my-list">
                ${items.map((item, idx) => `
                    <div class="my-row">
                        <span>${item.text}</span>
                        <button data-act="delete" data-idx="${idx}">×</button>
                    </div>
                `).join("")}
            </div>
        `;

        this.fitNode(node, isStructural);
    }
}

console.log("[Nodes2tips] Руководство и шпаргалка успешно обновлены с учетом всех боевых правок!");
