
    (function () {
      function showBootError(message) {
        try {
          const pill = document.querySelector("#dbState");
          if (pill) {
            pill.textContent = message || "Error de arranque";
            pill.classList.remove("state-loading", "state-clean", "state-saving");
            pill.classList.add("state-error");
          }
          const stack = document.querySelector("#toastStack");
          if (stack && message) {
            const item = document.createElement("div");
            item.className = "toast err";
            item.textContent = message;
            stack.appendChild(item);
          }
        } catch (err) { console.error(err); }
      }
      window.addEventListener("error", function (ev) {
        const msg = ev?.message || "Error JavaScript al arrancar SwiftRemo.";
        console.error("[SwiftRemo boot error]", msg, ev?.error || ev);
        showBootError(msg);
      });
      window.addEventListener("unhandledrejection", function (ev) {
        const reason = ev?.reason;
        const msg = reason?.message || String(reason || "Promesa rechazada durante el arranque.");
        console.error("[SwiftRemo boot rejection]", reason || ev);
        showBootError(msg);
      });
      setTimeout(function () {
        const pill = document.querySelector("#dbState");
        const txt = (pill?.textContent || "").trim();
        if (pill && (/^Preparando|^Cargando/.test(txt))) {
          showBootError("Arranque detenido: revisa caché, db/swiftremo.sqlite y app/wasm/sqlite3.wasm.");
        }
      }, 25000);
      console.log("SwiftRemo fase6.72.8 cargador público con diagnóstico de arranque");
    })();
  