function renderFoodspots() {
    if (!foodspotsLoaded) return;

    populateFoodspotsTop2Options();

    const top1 = foodspotsTop1Select?.value || 'ALL';
    const top2 = foodspotsTop2Select?.value || 'ALL';
    const list = filterFoodspotsBase();

    if (foodspotsEmptyTitle && foodspotsEmptyDesc) {
        foodspotsEmptyTitle.textContent = '공유된 맛집이 없어요';
        foodspotsEmptyDesc.textContent = '음식점 관리에서 ‘소문내기’를 체크하면 여기에 표시됩니다.';
    }

    if (!list.length) {
        showFoodspotsEmpty();
        return;
    }

    showFoodspotsContainer();

    // 표시 요약(기존 유지)
    if (foodspotsSummary) {
        foodspotsSummary.textContent = `총 ${list.length.toLocaleString()}건`;
    }

    // ✅✅✅ 여기(바로 이 위치)에 넣는 게 정답
    window.currentFoodspotsFiltered = list;
    renderFoodspotsUI(window.currentFoodspotsFiltered);
    return;

    // ▼▼▼ 아래 기존 “줄글 렌더링” 코드는 이제 실행되면 안 됩니다(카드 UI를 덮어씀)
    // 기존 코드(map 만들고 섹션 만드는 부분)는 삭제하거나 주석 처리하세요.
}


