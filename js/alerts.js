// 全域提示工具
window.showToast = function(message, type = 'success') {
    let bgColor = "linear-gradient(to right, #00b09b, #96c93d)"; // success
    if (type === 'error') bgColor = "linear-gradient(to right, #ff5f6d, #ffc371)";
    else if (type === 'info') bgColor = "linear-gradient(to right, #36D1DC, #5B86E5)";
    
    Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top", 
        position: "center", 
        style: {
            background: bgColor,
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            fontSize: "16px",
            fontWeight: "bold"
        }
    }).showToast();
};

window.showAlert = function(title, text = '', icon = 'warning') {
    return Swal.fire({
        title: title,
        text: text,
        icon: icon,
        confirmButtonColor: '#3b82f6',
        confirmButtonText: '確定'
    });
};

window.showConfirm = function(title, text = '', icon = 'warning', confirmText = '確定', cancelText = '取消') {
    return Swal.fire({
        title: title,
        text: text,
        icon: icon,
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: confirmText,
        cancelButtonText: cancelText
    });
};
