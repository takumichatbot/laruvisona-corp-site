function calcEstimate() {
    let total = 0;
    
    // 選択された値を取得
    const type = document.querySelector('input[name="type"]:checked')?.value || 0;
    const design = document.querySelector('input[name="design"]:checked')?.value || 0;
    const ai = document.querySelector('input[name="ai"]:checked')?.value || 0;
    
    // 合計計算
    total = parseInt(type) + parseInt(design) + parseInt(ai);
    
    // 数値のカウントアップアニメーション
    const counter = document.getElementById('estimate-price');
    const target = total;
    const current = parseInt(counter.innerText);
    
    let startTimestamp = null;
    const duration = 500;
    
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        counter.innerText = Math.floor(progress * (target - current) + current);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            counter.innerText = target;
        }
    };
    window.requestAnimationFrame(step);
}