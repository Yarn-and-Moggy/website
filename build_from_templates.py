import glob
import hashlib
import os

import yaml
from jinja2 import Environment, FileSystemLoader

STATIC_DIR = os.path.dirname(__file__)

def file_hash(path: str) -> str:
    full_path = os.path.join(STATIC_DIR, path.lstrip("/"))
    try:
        return hashlib.md5(open(full_path, "rb").read()).hexdigest()[:8]
    except FileNotFoundError:
        return "0"


def build():
    with open("templates/data.yaml") as f:
        raw = yaml.safe_load(f)

    env = Environment(loader=FileSystemLoader("templates"))
    env.globals["file_hash"] = file_hash

    for template_path in glob.glob("templates/*.jinja.html"):
        template_name = os.path.basename(template_path)
        # Base template - skip
        if template_name == "base.jinja.html":
            continue
        output_name = template_name.replace(".jinja.html", ".html")

        template = env.get_template(template_name)
        rendered = template.render(**raw)

        with open(output_name, "w") as f:
            f.write(rendered)

        print(f"Built {output_name}")

    for template_path in glob.glob("templates/js/*.jinja.js"):
        template_name = os.path.basename(template_path)
        output_name = template_name.replace(".jinja.js", ".js")

        template = env.get_template(os.path.join("js", template_name))
        rendered = template.render(**raw)

        output_path = os.path.join("js", output_name)
        with open(output_path, "w") as f:
            f.write(rendered)

        print(f"Built {output_path}")


if __name__ == "__main__":
    build()
