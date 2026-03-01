import glob
import os

import yaml
from jinja2 import Environment, FileSystemLoader


def build():
    with open("templates/data.yaml") as f:
        raw = yaml.safe_load(f)

    env = Environment(loader=FileSystemLoader("templates"))

    os.makedirs("out", exist_ok=True)

    for template_path in glob.glob("templates/*.jinja.html"):
        template_name = os.path.basename(template_path)
        output_name = template_name.replace(".jinja.html", ".html")

        template = env.get_template(template_name)
        rendered = template.render(**raw)

        output_path = os.path.join("out", output_name)
        with open(output_path, "w") as f:
            f.write(rendered)

        print(f"Built {output_path}")


if __name__ == "__main__":
    build()
