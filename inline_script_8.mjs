
    import { printClassOrder } from "./js/print-service-v6-3.js?v=100rc1";
    import { toast } from "./js/ui.js";
    document.addEventListener("DOMContentLoaded", () => {
      const btn = document.querySelector("#globalPrintOrderV61");
      if (btn) btn.addEventListener("click", () => {
        try { printClassOrder(window.SwiftRemoCore?.swiftDb, null); }
        catch (err) { console.error(err); toast(err.message || "No se pudo imprimir el pedido global.", "err"); }
      });
    });
  