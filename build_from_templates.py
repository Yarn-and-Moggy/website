import glob
import os

import yaml
from jinja2 import Environment, FileSystemLoader


def build():
    with open("templates/data.yaml") as f:
        raw = yaml.safe_load(f)

    env = Environment(loader=FileSystemLoader("templates"))

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
