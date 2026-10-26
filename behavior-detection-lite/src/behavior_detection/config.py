from dataclasses import dataclass
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = PACKAGE_ROOT / "models"


@dataclass(frozen=True)
class ModelSpec:
    key: str
    display_name: str
    filename: str
    violation_classes: frozenset[str]
    class_names: dict[str, str]

    @property
    def path(self) -> Path:
        return MODEL_DIR / self.filename


MODEL_SPECS = {
    "uniform": ModelSpec(
        key="uniform",
        display_name="反光服检测",
        filename="uniform.pt",
        violation_classes=frozenset({"clothes"}),
        class_names={
            "reflection": "穿反光衣",
            "clothes": "未穿反光衣",
        },
    ),
    "workwear": ModelSpec(
        key="workwear",
        display_name="蓝色工作服检测",
        filename="workwear.pt",
        violation_classes=frozenset({"no_workwear"}),
        class_names={
            "workwear": "穿指定蓝色工作服",
            "no_workwear": "未穿指定蓝色工作服",
        },
    ),
    "smoking": ModelSpec(
        key="smoking",
        display_name="抽烟检测",
        filename="smoking.pt",
        violation_classes=frozenset({"smoking"}),
        class_names={"smoking": "抽烟"},
    ),
    "sleeping": ModelSpec(
        key="sleeping",
        display_name="睡觉检测",
        filename="sleeping.pt",
        violation_classes=frozenset({"sleep"}),
        class_names={"sleep": "睡觉"},
    ),
}
